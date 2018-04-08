# vue-router 源码学习及收获

## 数据结构解释


### RawLocation 类型

RawLocation 类型的数据，是未经处理的（跳转）地址，可能是字符串，也可能是对象。

我们在使用`router.push/replace`跳转时，传入的第一个参数就是 RawLocation 类型，比如：

```js
// 字符串
router.push('home')

// 对象
router.push({ path: 'home' })

// 命名的路由
router.push({ name: 'user', params: { userId: 123 }})
```


### RouteRecord 类型

将`new VueRouter({ routes })`时传入的`routes`数组的每个元素（RouteConfig 类型）转化为最终的路由记录（RouteRecord 类型）

```js
{
  path: normalizedPath,  // 路径，'/foo/:bar'
  regex: compileRouteRegex(normalizedPath, pathToRegexpOptions), // 路径对应的正则表达式，/^\/foo\/([^\/]+?)\/?$/i
  components: route.components || { default: route.component }, // 统一处理成命名视图形式
  instances: {},
  name, // 路由的名称
  parent, // 路由的父路由，RouteRecord 类型
  matchAs,
  redirect: route.redirect, // 重定向的目标，RawLocation 类型或返回 RawLocation 类型的函数
  beforeEnter: route.beforeEnter, // 路由的 beforeEnter 守卫
  meta: route.meta || {}, // 路由元信息
  props: route.props == null // 路由 props（路由与 URL 解耦）
    ? {}
    : route.components
      ? route.props
      : { default: route.props }
}
```


### Route

路由对象，比如`to`、`from`，其数据结构如下所示。
```js
// http://localhost:8080/#/route3/2#111，这是个动态路由，path 为：/route3/:id
{
  fullPath: "/route3/2#111",
  hash: "#111",
  matched: [{…}], // 匹配的路由记录 RouteRecord 数组
  meta: {},
  name: "route3",
  params: {i: "2"},
  path: "/route3/2",
  query: {},
  __proto__: Object
}
```


### Location


## 疑难点分析

### 当前路由是如何变化的？router-view 组件如何随之变化？

`install.js`在安装`vue-router`插件时，会添加全局的`beforeCreate`钩子。

在`beforeCreate`钩子里，若是带有路由配置的实例（一般是根实例），则会初始化 router，并将`_route`设置为响应式的，如此，以后根实例上的`_route`变化后，就会通知到所有的`watcher`

```js
Vue.mixin({
  beforeCreate () {
    if (isDef(this.$options.router)) {
      // 根实例
      this._routerRoot = this
      this._router = this.$options.router
      this._router.init(this)

      // 将 _route 设置为响应式
      Vue.util.defineReactive(this, '_route', this._router.history.current)
    } else {
      // 组件实例
      this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
    }
    registerInstance(this, this)
  },
  destroyed () {
    registerInstance(this)
  }
})
```

而在上面`this._router.init(this)`的源码里，会给`history`添加路由变化监听函数，一旦路由变化，监听函数就会执行，继而更改实例的`_route`属性，而这个属性是响应式的。只要`_route`一改变，所有依赖于`_route`的组件（`router-view`）都会重新`render`。

```js
export default class VueRouter {
  // ...
  init (app: any /* Vue component instance */) {
    process.env.NODE_ENV !== 'production' && assert(
      install.installed,
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )

    this.apps.push(app)

    // main app already initialized.
    if (this.app) {
      return
    }

    this.app = app

    const history = this.history

    if (history instanceof HTML5History) {
      history.transitionTo(history.getCurrentLocation())
    } else if (history instanceof HashHistory) {
      const setupHashListener = () => {
        history.setupListeners()
      }
      history.transitionTo(
        history.getCurrentLocation(),
        setupHashListener,
        setupHashListener
      )
    }

    // 监听 history 变化，修改根实例的 _route
    history.listen(route => {
      this.apps.forEach((app) => {
        app._route = route
      })
    })
  }
  // ...
}
```
