/* @flow */

/**
 * 基于 base 路径，处理 relative 路径，返回最终的绝对路径
 * @param {String} relative 当前路径
 * @param {String} base 基路径
 * @param {Boolean} append 是否追加路径
 * @return {String} 最终的绝对路径
 */
export function resolvePath (
  relative: string,
  base: string,
  append?: boolean
): string {
  const firstChar = relative.charAt(0)
  if (firstChar === '/') {
    // 绝对路径
    return relative
  }

  if (firstChar === '?' || firstChar === '#') {
    return base + relative
  }

  const stack = base.split('/')

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    stack.pop()
  }

  // resolve relative path
  const segments = relative.replace(/^\//, '').split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment === '..') {
      stack.pop()
    } else if (segment !== '.') {
      stack.push(segment)
    }
  }

  // 保证最终返回的是绝对路径
  if (stack[0] !== '') {
    stack.unshift('')
  }

  return stack.join('/')
}

/**
 * 将 path 解析成 path、query、hash 三部分（都是字符串）
 * @param {String} path 路径
 * @return {Object} 返回对象
 *   {String} path 路径
 *   {String} query 查询参数
 *   {String} hash 哈希内容
 */
export function parsePath (path: string): {
  path: string;
  query: string;
  hash: string;
} {
  let hash = ''
  let query = ''

  const hashIndex = path.indexOf('#')
  if (hashIndex >= 0) {
    hash = path.slice(hashIndex)
    path = path.slice(0, hashIndex)
  }

  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    query = path.slice(queryIndex + 1)
    path = path.slice(0, queryIndex)
  }

  return {
    path,
    query,
    hash
  }
}

export function cleanPath (path: string): string {
  return path.replace(/\/\//g, '/')
}
