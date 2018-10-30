/*
*create and export configuation variables
*
*/

//container for all environments
const environments = {}

//staging (default) environemnt
environments.staging = {
  envname: 'staging',
  httpPort: 3000,
  httpsPort: 3001,
  uidLength: 20,
  hashingSecret: 'fichaKabisa',
  secret: '--- please use your key ---',
  api_key:'--- please use your key ---',
  domain: '--- insert your domain ---',
  currency: 'kes' 
}

//production environment
environments.production = {
  'envname': 'production',
  'httpPort': 8080,
  'uidLength': 20,
  'hashingSecret': 'fichaKabisa'
}

//determine which environment to export
const currentENV = typeof(process.NODE_ENV) == 'string' ? process.NODE_ENV.toLowerCase() : '';
const envToExport = typeof(environments[currentENV]) == 'object' ? environments[currentENV] : environments.staging;

module.exports = envToExport;