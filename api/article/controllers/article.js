'use strict';

const crypto = require('crypto');

const VOTER_ID = /^[a-f0-9]{32}$/;

function ratingSecret() {
  return process.env.RATING_SECRET || 'zibamag-rating-v1';
}

function toRating(value) {
  const rating = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return rating;
}

function roundAverage(sum, count) {
  if (!count) return 0;
  return Math.round((sum / count) * 10) / 10;
}

function summarize(rows) {
  let ratingSum = 0;
  let ratingCount = 0;

  for (const row of rows || []) {
    const value = toRating(row.value);
    if (value == null) continue;
    ratingSum += value;
    ratingCount += 1;
  }

  return {
    ratingSum,
    ratingCount,
    average: roundAverage(ratingSum, ratingCount),
  };
}

function readVoter(ctx) {
  const voterId = String(ctx.get('x-voter-id') || '');
  const signature = String(ctx.get('x-voter-sign') || '');
  if (!VOTER_ID.test(voterId) || !/^[a-f0-9]{64}$/.test(signature)) return null;

  const expected = crypto
    .createHmac('sha256', ratingSecret())
    .update(voterId)
    .digest('hex');
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(signature, 'utf8');
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }
  return voterId;
}

function voteKeyFor(articleId, voter) {
  return `${articleId}:${voter}`;
}

async function loadVotes(articleId) {
  return strapi.query('rating').find({ article: articleId, _limit: -1 });
}

async function findVotesForVoter(articleId, voter) {
  const voteKey = voteKeyFor(articleId, voter);
  const byKey = await strapi.query('rating').find({ voteKey, _limit: 20 });
  if (byKey && byKey.length) return byKey;

  return strapi.query('rating').find({
    article: articleId,
    voter,
    _limit: 20,
  });
}

async function refreshArticleRating(articleId) {
  const summary = summarize(await loadVotes(articleId));
  await strapi.query('article').update(
    { id: articleId },
    { ratingSum: summary.ratingSum, ratingCount: summary.ratingCount }
  );
  return summary;
}

/**
 * One score per voter per article. Repeat clicks update the same row —
 * they must never create extra votes or inflate ratingCount.
 */
async function saveVote(articleId, voter, value) {
  const voteKey = voteKeyFor(articleId, voter);
  const matches = await findVotesForVoter(articleId, voter);
  const primary = matches[0] || null;

  // Collapse accidental duplicates from older buggy clients/deploys.
  if (matches.length > 1) {
    for (let i = 1; i < matches.length; i += 1) {
      await strapi.query('rating').delete({ id: matches[i].id });
    }
  }

  if (!primary) {
    try {
      await strapi.query('rating').create({
        voteKey,
        voter,
        value,
        article: articleId,
      });
      return 'created';
    } catch (error) {
      const raced = await findVotesForVoter(articleId, voter);
      if (!raced.length) throw error;
      if (toRating(raced[0].value) === value) return 'unchanged';
      await strapi.query('rating').update({ id: raced[0].id }, { value, voteKey });
      return 'updated';
    }
  }

  if (toRating(primary.value) === value) return 'unchanged';
  await strapi.query('rating').update(
    { id: primary.id },
    { value, voteKey, voter, article: articleId }
  );
  return 'updated';
}

function ratingPayload(summary, userRating, status) {
  return {
    ratingSum: summary.ratingSum,
    ratingCount: summary.ratingCount,
    average: summary.average,
    userRating: userRating == null ? null : userRating,
    status: status || null,
  };
}

function legacySummary(article) {
  const ratingCount = Math.max(0, Math.floor(Number(article.ratingCount) || 0));
  const ratingSum = Number(article.ratingSum) || 0;
  if (ratingCount <= 0 || ratingSum <= 0) return null;

  // Old endpoint added the clicked star on every request, so legacy
  // averages can be nonsense — clamp to a displayable 1..5 star mean.
  const average = Math.min(5, Math.max(1, roundAverage(ratingSum, ratingCount)));
  return { ratingSum, ratingCount, average };
}

module.exports = {
  async view(ctx) {
    const { id } = ctx.params;
    const article = await strapi.query('article').findOne({ id });
    if (!article) return ctx.notFound('Article not found');

    const views = (Number(article.views) || 0) + 1;
    const updated = await strapi.query('article').update({ id }, { views });
    return { id: updated.id, views: updated.views };
  },

  async rateInfo(ctx) {
    const { id } = ctx.params;
    const article = await strapi.query('article').findOne({ id });
    if (!article) return ctx.notFound('Article not found');

    let summary = summarize(await loadVotes(article.id));
    if (summary.ratingCount === 0) {
      const legacy = legacySummary(article);
      if (legacy) summary = legacy;
    }

    const voter = readVoter(ctx);
    let userRating = null;
    if (voter) {
      const existing = await findVotesForVoter(article.id, voter);
      userRating = existing[0] ? toRating(existing[0].value) : null;
    }

    return ratingPayload(summary, userRating, null);
  },

  async rate(ctx) {
    const { id } = ctx.params;
    const rating = toRating((ctx.request.body || {}).rating);
    if (rating == null) {
      return ctx.badRequest('rating must be an integer from 1 to 5');
    }

    const voter = readVoter(ctx);
    if (!voter) return ctx.forbidden('Invalid voter');

    const article = await strapi.query('article').findOne({ id });
    if (!article) return ctx.notFound('Article not found');

    const status = await saveVote(article.id, voter, rating);
    const summary = await refreshArticleRating(article.id);
    return ratingPayload(summary, rating, status);
  },
};
