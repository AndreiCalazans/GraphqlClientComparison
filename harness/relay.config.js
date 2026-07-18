module.exports = {
  src: './src',
  schema: './src/relay/schema.graphql',
  language: 'typescript',
  artifactDirectory: './src/relay/__generated__',
  excludes: ['**/node_modules/**', '**/__mocks__/**', '**/__generated__/**'],
  eagerEsModules: true,
};
