/* @flow */

import { warn } from './warn'
import Regexp from 'path-to-regexp'

// $flow-disable-line
const regexpCompileCache: {
  [key: string]: Function
} = Object.create(null)

/**
 * 将动态路径加入参数，填充成完整路径
 * @param {String} path 路径，比如 '/user/:id'
 * @param {Object} params 参数对象，比如 {id: 1}
 * @param {String} routeMsg 路由信息，用于报错
 * @return {String} 完整的路径，比如 '/user/1'
 */
export function fillParams (
  path: string,
  params: ?Object,
  routeMsg: string
): string {
  try {
    const filler =
      regexpCompileCache[path] ||
      (regexpCompileCache[path] = Regexp.compile(path))
    return filler(params || {}, { pretty: true })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      warn(false, `missing param for ${routeMsg}: ${e.message}`)
    }
    return ''
  }
}
