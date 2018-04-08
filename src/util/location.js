/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'

/**
 * 基于当前路由标准化 RawLocation 为 Location 对象
 * @param {String/Object} raw 初始的 location
 * @param {*} current 当前路由
 * @param {Boolean} append 路由是否追加
 * @param {*} router 路由器对象
 */
export function normalizeLocation (
  raw: RawLocation,
  current: ?Route,
  append: ?boolean,
  router: ?VueRouter
): Location {
  let next: Location = typeof raw === 'string' ? { path: raw } : raw
  // named target
  if (next.name || next._normalized) {
    // 命名路由 || 已经标准化过
    return next
  }

  // relative params
  // 仅修改动态路由的路径参数
  if (!next.path && next.params && current) {
    next = assign({}, next)
    next._normalized = true
    // 获取新路由的 params
    const params: any = assign(assign({}, current.params), next.params)
    if (current.name) {
      // 复用当前路由的 name
      next.name = current.name
      next.params = params
    } else if (current.matched.length) {
      // 否则，使用当前路由最后一个匹配的路由记录的 path（需要填充参数）
      const rawPath = current.matched[current.matched.length - 1].path
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }

  // 处理路径
  const parsedPath = parsePath(next.path || '')
  const basePath = (current && current.path) || '/'
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath

  // 合并 query，并处理成对象形式（path 里存在的查询参数 && query 属性里的查询参数）
  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )

  // 处理 hash
  let hash = next.hash || parsedPath.hash
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }

  return {
    _normalized: true,
    path,
    query,
    hash
  }
}

function assign (a, b) {
  for (const key in b) {
    a[key] = b[key]
  }
  return a
}
