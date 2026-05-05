// https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-javascript-mssql-quickstart?view=azuresql&tabs=passwordless%2Cservice-connector%2Cportal#configure-the-mssql-connection-object

import * as dotenv from "dotenv"

dotenv.config({ path: ".env", debug: true })

const host = process.env.PSQL_SERVER
const database = process.env.PSQL_DATABASE
const port = +process.env.PSQL_PORT
const user = process.env.PSQL_USER
const password = process.env.PSQL_PASSWORD

export const PASSWORD_CONFIG = {
  host,
  user,
  database,
  password,
  port,
  ssl: true,
}
