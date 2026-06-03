import * as Joi from 'joi'

export default Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  DB_PORT: Joi.number().port().default(5432),
  DB_PASSWORD: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_HOST: Joi.string().required(),
  DB_SYNC: Joi.string().valid('true', 'false').default('false'),
  DB_AUTO_LOAD_ENTITIES: Joi.string().valid('true', 'false').default('false'),
})
