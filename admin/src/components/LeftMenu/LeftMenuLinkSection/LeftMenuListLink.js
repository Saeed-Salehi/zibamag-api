import styled from 'styled-components';

// Strapi caps every left-menu section at 180px. Collection Types then
// clips the last entries (Pages, Tags), so Tags is not visible next to Comments.
const LeftMenuListLink = styled.div`
  max-height: calc(100vh - 280px);
  margin-bottom: 19px;
  margin-right: 25px;
  overflow: auto;
`;

export default LeftMenuListLink;
