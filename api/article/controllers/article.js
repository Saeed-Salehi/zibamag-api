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
    average: ratingCount ? ratingSum / ratingCount : 0,
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

async function loadVotes(articleId) {
  return strapi.query('rating').find({ article: articleId, _limit: -1 });
}

async function refreshArticleRating(articleId) {
  const summary = summarize(await loadVotes(articleId));
  await strapi.query('article').update(
    { id: articleId },
    { ratingSum: summary.ratingSum, ratingCount: summary.ratingCount }
  );
  return summary;
}

async function saveVote(articleId, voter, value) {
  const voteKey = `${articleId}:${voter}`;
  const existing = await strapi.query('rating').findOne({ voteKey });

  if (!existing) {
    try {
      await strapi.query('rating').create({
        voteKey,
        voter,
        value,
        article: articleId,
      });
      return 'created';
    } catch (error) {
      const raced = await strapi.query('rating').findOne({ voteKey });
      if (!raced) throw error;
      if (toRating(raced.value) === value) return 'unchanged';
      await strapi.query('rating').update({ id: raced.id }, { value });
      return 'updated';
    }
  }

  if (toRating(existing.value) === value) return 'unchanged';
  await strapi.query('rating').update({ id: existing.id }, { value });
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

    const summary = summarize(await loadVotes(article.id));
    if (summary.ratingCount === 0) {
      const legacyCount = Number(article.ratingCount) || 0;
      const legacySum = Number(article.ratingSum) || 0;
      if (legacyCount > 0 && legacySum > 0) {
        summary.ratingCount = legacyCount;
        summary.ratingSum = legacySum;
        summary.average = Math.min(5, legacySum / legacyCount);
      }
    }
    const voter = readVoter(ctx);
    let userRating = null;
    if (voter) {
      const existing = await strapi.query('rating').findOne({
        voteKey: `${article.id}:${voter}`,
      });
      userRating = existing ? toRating(existing.value) : null;
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
