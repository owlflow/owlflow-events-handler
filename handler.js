// TODO: Apply Logging middleware for better logging
// TODO: Add an event bus to publish the data for other nodes
'use strict'

import EventPublisher from './src/lib/EventPublisher'
import FlowNodeContext from './src/lib/FlowNodeContext'

const asyncForEach = async (array, cb) => {
  for (let index = 0; index < array.length; index++) {
    await cb(array[index], index, array)
  }
}

const filterData = async (filters, flattenData) => {
  if (filters.type === 'not') {
    if (!(await filterData(filters.field, flattenData))) {
      return true
    }
  } else if (filters.type === 'regex') {
    const regRes = (flattenData[filters.dimension]).toString().match(new RegExp(filters.value, 'gim'))

    if (regRes)
      return regRes[0] === (flattenData[filters.dimension]).toString()

    return false
  } else if (filters.type === 'keyComparison') {
    if ((flattenData[filters.dimensions[0]]).toString() === (flattenData[filters.dimensions[1]]).toString()) {
      return true
    }
  } else if (filters.type === 'selector') {
    if ((flattenData[filters.dimension]).toString() === (filters.value).toString()) {
      return true
    }
  } else if (filters.type === 'in') {
    if ((filters.values || []).includes((flattenData[filters.dimension]).toString())) {
      return true
    }
  } else if (filters.type === 'and') {
    // map through the filters list
    const promises = (filters.fields || []).map(async (filter) => {
      if (await filterData(filter, flattenData)) {
        return true
      } else {
        return false
      }
    })

    // wait until all promises resolve
    const results = await Promise.all(promises)

    if (!results.includes(false)) {
      return true
    }
  } else if (filters.type === 'or') {
    // map through the filters list
    const promises = (filters.fields || []).map(async (filter) => {
      if (await filterData(filter, flattenData)) {
        return true
      } else {
        return false
      }
    })

    // wait until all promises resolve
    const results = await Promise.all(promises)
    if (results.includes(true)) {
      return true
    }
  } else {
    console.log('otherFilters', filters)
  }

  return false
}

// The event handler endpoints
exports.owlFlowFilterV1Handler = async (event, context, callback) => {
  try {
    console.log(JSON.stringify(event))

    const nodeData = event.detail.nodeDetail

    if (nodeData.paused || nodeData.rootPaused) {
      throw new Error('OWLFlow root or node is inactive')
    }

    if ((await filterData(nodeData.meta.filter, event.detail.flattenData))) {
      await asyncForEach((nodeData.childrenIds || []), async (childrenId) => {
        const childrenNode = await FlowNodeContext.byNodeId(event.detail.flowId, childrenId) // nodes[childrenId]

        console.log(childrenNode)

        console.log(await EventPublisher.execute({
          Entries: [
            {
              Detail: JSON.stringify({
                event: 'owlflow.hooks',
                eventSource: 'hooks.owlflow.io',
                eventVersion: '1.0',
                consumerAPI: childrenNode.api,
                organizationId: event.detail.organizationId,
                flowId: event.detail.flowId,
                nodeDetail: childrenNode,
                flattenData: Object.assign(event.detail.flattenData, {})
              }),
              DetailType: 'owlflow',
              EventBusName: process.env.OWLHUB_EVENT_BUS_NAME,
              Resources: [
                `orn:owlhub:owlflow:${event.detail.organizationId}:flows/${event.detail.flowId}`
              ],
              Source: 'owlhub.owlflow'
            }
          ]
        }))
      })
    }
  } catch (e) {
    console.log(e)
  }

  callback(null, {
    statusCode: '200',
    body: JSON.stringify(event),
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
