export default {
  paths: ['e2etest/features/**/*.feature'],
  import: ['e2etest/steps/**/*.js'],
  format: ['progress', 'html:e2etest/report.html'],
};
