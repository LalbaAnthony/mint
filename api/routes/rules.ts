import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  createRuleRequestSchema,
  reorderRulesRequestSchema,
  ruleListResponseSchema,
  ruleSchema,
  ruleSuggestionQuerySchema,
  ruleSuggestionSchema,
  updateRuleRequestSchema,
} from '@mint/shared/schemas/rules'
import { toIssues, validationFailed } from '../http/http-error.js'
import { ensureSameMembers } from '../http/ordering.js'
import { defineUserRoute } from '../http/route.js'
import { findUserOperation } from '../operations/operations.js'
import {
  findUserRule,
  nextRulePriority,
  ruleColumns,
  ruleFieldsOf,
  suggestRule,
  toRule,
  validateRuleReferences,
} from '../rules/rules.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import { operationTagIds } from '../tags/tags.js'

const tag = 'rules'

const accessErrors = { 401: errorResponse('No valid session') }

const resourceErrors = {
  ...accessErrors,
  404: errorResponse('Unknown rule, account, category or tag'),
}

export const listRulesRoute = defineUserRoute({
  method: 'get',
  path: '/rules',
  summary: 'Categorization rules by priority (REG-01, REG-02)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Rules', schema: ruleListResponseSchema },
    ...accessErrors,
  },
  handle: async ({ app, user }) => {
    const rules = await app.models.CategorizationRule.findAll({
      where: { userId: user.id },
      order: [
        ['priority', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    })
    return { status: 200, body: rules.map(toRule) }
  },
})

export const createRuleRoute = defineUserRoute({
  method: 'post',
  path: '/rules',
  summary:
    'Create a rule on the bank label, optionally the account, the sign and an amount range, classifying into a category or a transfer, placed last (REG-01)',
  tag,
  body: createRuleRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Rule created', schema: ruleSchema },
    400: errorResponse('Invalid body or regular expression'),
    ...resourceErrors,
    409: errorResponse('Archived account or category'),
  },
  handle: async ({ app, user, body }) => {
    await validateRuleReferences(app, user.id, body, null)
    const rule = await app.models.CategorizationRule.create({
      ...ruleColumns(body),
      userId: user.id,
      priority: await nextRulePriority(app, user.id),
    })
    return { status: 201, body: toRule(rule) }
  },
})

export const updateRuleRoute = defineUserRoute({
  method: 'patch',
  path: '/rules/:id',
  summary: 'Modify a rule',
  tag,
  body: updateRuleRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Rule modified', schema: ruleSchema },
    400: errorResponse('Invalid body or regular expression'),
    ...resourceErrors,
    409: errorResponse('Archived account or category newly referenced'),
  },
  handle: async ({ app, user, params, body }) => {
    const rule = await findUserRule(app, user.id, params.id)
    const previous = ruleFieldsOf(rule)
    const merged = createRuleRequestSchema.safeParse({ ...previous, ...body })
    if (!merged.success) {
      throw validationFailed(toIssues(merged.error))
    }
    await validateRuleReferences(app, user.id, merged.data, previous)
    await rule.update(ruleColumns(merged.data))
    return { status: 200, body: toRule(rule) }
  },
})

export const deleteRuleRoute = defineUserRoute({
  method: 'delete',
  path: '/rules/:id',
  summary: 'Delete a rule; the operations it classified keep their category',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Rule deleted' },
    ...resourceErrors,
  },
  handle: async ({ app, user, params }) => {
    const rule = await findUserRule(app, user.id, params.id)
    await rule.destroy()
    return { status: 204 }
  },
})

export const reorderRulesRoute = defineUserRoute({
  method: 'post',
  path: '/rules/reorder',
  summary:
    'Set the priority of every rule, the first one applying first (REG-02)',
  tag,
  body: reorderRulesRequestSchema,
  params: noParams,
  responses: {
    204: { description: 'Order saved' },
    400: errorResponse('Invalid request body'),
    ...accessErrors,
    409: errorResponse('The list is not exactly the rules of the user'),
  },
  handle: async ({ app, user, body }) => {
    await app.sequelize.transaction(async (transaction) => {
      const rules = await app.models.CategorizationRule.findAll({
        where: { userId: user.id },
        transaction,
      })
      ensureSameMembers(
        rules.map((rule) => rule.id),
        body.ruleIds,
      )
      for (const [index, id] of body.ruleIds.entries()) {
        await app.models.CategorizationRule.update(
          { priority: index },
          { where: { id, userId: user.id }, transaction },
        )
      }
    })
    return { status: 204 }
  },
})

export const suggestRuleRoute = defineUserRoute({
  method: 'get',
  path: '/rules/suggestion',
  summary:
    'Rule prefilled from an imported operation: its bank label without digits nor dates, its sign, its category and its tags (REG-03)',
  tag,
  body: noBody,
  params: noParams,
  query: ruleSuggestionQuerySchema,
  responses: {
    200: { description: 'Suggested rule', schema: ruleSuggestionSchema },
    400: errorResponse('Invalid operation identifier'),
    ...accessErrors,
    404: errorResponse('Unknown operation'),
    409: errorResponse('Operation without bank label'),
  },
  handle: async ({ app, user, query }) => {
    const operation = await findUserOperation(app, user.id, query.operationId)
    return {
      status: 200,
      body: suggestRule(operation, await operationTagIds(app, operation.id)),
    }
  },
})
