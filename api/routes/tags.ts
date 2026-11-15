import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  tagListResponseSchema,
  tagRequestSchema,
  tagSchema,
} from '@mint/shared/schemas/tags'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import {
  deleteTag,
  findTagByName,
  findUserTag,
  listTags,
  tagById,
  withUniqueTagName,
} from '../tags/tags.js'

const tag = 'tags'

const accessErrors = { 401: errorResponse('No valid session') }

const resourceErrors = {
  ...accessErrors,
  404: errorResponse('Unknown tag'),
}

export const listTagsRoute = defineUserRoute({
  method: 'get',
  path: '/tags',
  summary:
    'List the tags by name, with the number of operations (a transfer counts once), schedules and rules carrying each (CAT-09)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Tags', schema: tagListResponseSchema },
    ...accessErrors,
  },
  handle: async ({ app, user }) => ({
    status: 200,
    body: await listTags(app, user.id),
  }),
})

export const createTagRoute = defineUserRoute({
  method: 'post',
  path: '/tags',
  summary:
    'Create a tag, or return the existing one whose name matches regardless of case (CAT-09)',
  tag,
  body: tagRequestSchema,
  params: noParams,
  responses: {
    200: { description: 'Existing tag of that name', schema: tagSchema },
    201: { description: 'Tag created', schema: tagSchema },
    400: errorResponse('Invalid body'),
    ...accessErrors,
  },
  handle: async ({ app, user, body }) => {
    const existing = await findTagByName(app, user.id, body.name)
    if (existing !== null) {
      return { status: 200, body: await tagById(app, user.id, existing.id) }
    }
    try {
      const created = await withUniqueTagName(() =>
        app.models.Tag.create({ userId: user.id, name: body.name }),
      )
      return { status: 201, body: await tagById(app, user.id, created.id) }
    } catch (error) {
      const raced = await findTagByName(app, user.id, body.name)
      if (raced === null) {
        throw error
      }
      return { status: 200, body: await tagById(app, user.id, raced.id) }
    }
  },
})

export const updateTagRoute = defineUserRoute({
  method: 'patch',
  path: '/tags/:id',
  summary: 'Rename a tag (CAT-09)',
  tag,
  body: tagRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Tag renamed', schema: tagSchema },
    400: errorResponse('Invalid body'),
    ...resourceErrors,
    409: errorResponse('Another tag already has this name'),
  },
  handle: async ({ app, user, params, body }) => {
    const found = await findUserTag(app, user.id, params.id)
    await withUniqueTagName(() => found.update({ name: body.name }))
    return { status: 200, body: await tagById(app, user.id, found.id) }
  },
})

export const deleteTagRoute = defineUserRoute({
  method: 'delete',
  path: '/tags/:id',
  summary:
    'Delete a tag: it is removed from the operations, schedules and rules carrying it (CAT-09)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Tag deleted' },
    ...resourceErrors,
  },
  handle: async ({ app, user, params }) => {
    await app.sequelize.transaction(async (transaction) => {
      const found = await findUserTag(app, user.id, params.id, transaction)
      await deleteTag(app, found, transaction)
    })
    return { status: 204 }
  },
})
