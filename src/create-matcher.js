/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
  match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
  addRoutes: (routes: Array<RouteConfig>) => void;
};

export function createMatcher (
  routes: Array<RouteConfig>,
  router: VueRouter
): Matcher {
  const { pathList, pathMap, nameMap } = createRouteMap(routes)

  /**
   * 添加路由记录
   */
  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }

  /**
   * 根据 RawLocation 创建 Route（注意：创建的 Route 可能无法匹配到任何路由记录）
   * （先基于已有的路由记录匹配后创建，没有匹配不到，直接创建新的路由）
   */
  function match (
    raw: RawLocation, // 未经处理的地址，可能是字符串
    currentRoute?: Route, // 当前路由
    redirectedFrom?: Location // 从某个地址重定向过来
  ): Route {
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location

    if (name) {
      // 命名路由
      const record = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      // 匹配不到已注册的命名路由，创建新的 Route
      if (!record) return _createRoute(null, location)

      // 路径里必须的 key
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)

      if (typeof location.params !== 'object') {
        location.params = {}
      }

      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            // 从当前路由里获取需要的参数
            location.params[key] = currentRoute.params[key]
          }
        }
      }

      if (record) {
        // 根据 path 和 params 获取到最终路径
        // 比如 path = '/foo/:bar', params = {bar: hello}，最终获取的是 '/foo/hello'
        location.path = fillParams(record.path, location.params, `named route "${name}"`)
        return _createRoute(record, location, redirectedFrom)
      }
    } else if (location.path) {
      // 非命名组件
      location.params = {}
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        if (matchRoute(record.regex, location.path, location.params)) {
          // 若能匹配到已有的路由记录，则基于已有的路由记录创建 Route
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // 未匹配到已有的路由记录，创建新的 Route
    return _createRoute(null, location)
  }


  /**
   * 处理重定向的路由的匹配（需要再次调用 match 去匹配）
   * @param {*} record 重定向的路由记录
   * @param {*} location location 对象
   */
  function redirect (
    record: RouteRecord,
    location: Location
  ): Route {
    const originalRedirect = record.redirect
    // record.redirect 可以是返回重定向的 字符串路径/路径对象 的函数
    let redirect = typeof originalRedirect === 'function'
        ? originalRedirect(createRoute(record, location, null, router))
        : originalRedirect

    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      return _createRoute(null, location)
    }

    const re: Object = redirect
    const { name, path } = re
    let { query, hash, params } = location
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params

    if (name) {
      // resolved named direct
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      return match({
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) {
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location)
    }
  }

  /**
   * 处理别名的路由的匹配（需要再次调用 match 去匹配）
   * @param {*} record 重定向的路由记录
   * @param {*} location location 对象
   */
  function alias (
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route {
    // 获取到真正的 path
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

  /**
   * 创建路由
   */
  function _createRoute (
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    if (record && record.redirect) {
      // 路由记录有重定向
      return redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) {
      // 路由记录是别名路由
      return alias(record, location, record.matchAs)
    }
    return createRoute(record, location, redirectedFrom, router)
  }

  return {
    match,
    addRoutes
  }
}

/**
 * 判断是否匹配路由记录，如果匹配，获取匹配的参数及值
 */
function matchRoute (
  regex: RouteRegExp, // 路由记录路径的 正则表达式
  path: string, // 要匹配的路径
  params: Object // 要匹配的路径的路径参数
): boolean {
  const m = path.match(regex)

  if (!m) {
    return false
  } else if (!params) {
    return true
  }

  // 将匹配到的参数及其值加入到 params 里
  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1]
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      params[key.name] = val
    }
  }

  return true
}

function resolveRecordPath (path: string, record: RouteRecord): string {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
