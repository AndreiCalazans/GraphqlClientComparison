module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Relay's babel plugin transforms graphql`` tagged template literals into
    // requires of the compiler-generated artifacts. Only the Relay variant uses
    // it; harmless for the others.
    plugins: [['babel-plugin-relay', { artifactDirectory: './src/relay/__generated__' }]],
  };
};
