import FunctionsClient from './FunctionsClient'

async function byWebhookId (accountId, webhookId) {
  const result = await FunctionsClient.execute(process.env.GET_FLOW_CONTEXT_FUNCTION, { accountId, webhookId })
  if (!result || !result.id) throw new Error('Cant validate the webhook')
  return result
}

export default {
  byWebhookId
}
