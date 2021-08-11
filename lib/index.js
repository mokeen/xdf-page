const { src, dest, series, parallel, watch } = require('gulp')

const path = require('path')

const loadPlugins = require('gulp-load-plugins')
const browserSync = require('browser-sync')
const del = require('del')

// 创建插件引用对象
const plugins = loadPlugins()
// 创建一个开发服务器
const bs = browserSync.create()

// 获取当前命令执行的工作目录，也就是我们的项目目录
const cwd = process.cwd()

let config = {
  // default config
  build: {
    src: 'src',
    dist: 'dist',
    temp: 'temp',
    public: 'public',
    paths: {
      styles: 'assets/styles/*.scss',
      scripts: 'assets/scripts/*.js',
      pages: '**/*.html',
      images: 'assets/images/**',
      fonts: 'assets/fonts/**'
    }
  }
}

try {
  // 加载项目中的配置
  const loadedConfig = require(path.join(cwd, 'pages.config.js'))
  // 和默认配置进行合并
  config = Object.assign({}, config, loadedConfig)
} catch (error) {
  console.error(error)
}

const clean = () => {
  // 删除发布目录和临时目录
  return del([config.build.dist, config.build.temp])
}

// 以下 style、script、page 处理后先输出至temp目录
const style = () => {
  // base: 'src' 保持目录层级，以src为基础目录
  return src(config.build.paths.styles, { base: config.build.src, cwd: config.build.src })
    // 展开代码，花括号闭合符另起一行
    .pipe(plugins.sass({ outputStyle: 'expanded' }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }))
}

const script = () => {
  return src(config.build.paths.scripts, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.babel({ presets: [require('@babel/preset-env')] }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }))
}

const page = () => {
  return src(config.build.paths.pages, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.swig({ data: config.data }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }))
}

// 以下静态文件在最终打包时才处理，直接输出至dist
const image = () => {
  return src(config.build.paths.images, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist))
}

const font = () => {
  return src(config.build.paths.fonts, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist))
}

const extra = () => {
  // 这里的根目录就设置为 public
  return src('**', { base: config.build.public, cwd: config.build.public })
    .pipe(dest(`${config.build.dist}/${config.build.public}`))
}

const serve = () => {
  // 监听动态文件的变化进行编译
  watch(config.build.paths.styles, { cwd: config.build.src }, style)
  watch(config.build.paths.scripts, { cwd: config.build.src }, script)
  watch(config.build.paths.pages, { cwd: config.build.src }, page)

  // 监听静态文件的变化，然后刷新浏览器，watch 的第二个参数可以是一个任务函数
  // 而 browserSync 的 reload 方法就是一个任务函数
  watch([
    config.build.paths.images,
    config.build.paths.fonts,
  ], { cwd: config.build.src },  bs.reload)

  watch([
    '**'
  ], { cwd: config.build.public },  bs.reload)

  // 这里去除files，文件发生改变时添加一个 reload 任务
  // baseDir 添加 src 和 public，在开发环境时不必要打包静态文件
  // 所有静态文件都去源码目录中查找
  // 文件查找路径 temp -> src -> public
  return bs.init({
    notify: false,
    port: 80,
    open: true,
    server: {
      // 这里将dist修改为temp
      baseDir: [config.build.temp, config.build.src, config.build.public],
      routes: {
        '/node_modules': 'node_modules'
      }
    }
  })
}

const useref = () => {
  // 这里自己处理temp目录中的html文件
  return src(`${config.build.temp}/${config.build.paths.pages}`)
    // useref的查找目录为temp和根目录下的node_modules
    .pipe(plugins.useref({ searchPath: [config.build.temp, '.'] }))
    .pipe(plugins.if(/.js$/, plugins.uglify()))
    .pipe(plugins.if(/.css$/, plugins.cleanCss()))
    .pipe(plugins.if(/.html$/, plugins.htmlmin({
      collapseWhitespace: true,
      minifyJS: true,
      minifyCSS: true
    })))
    // 避免读写操作冲突，输出到另一个目录
    .pipe(dest(config.build.dist))
}

const compile = parallel(style, script, page)

// 打包时才处理静态文件，并进行文件引用处理和文件压缩，进行优化
const build = series(clean, parallel(series(compile, useref), image, font, extra))

// 开发环境不需要
const develop = series(compile, serve)

module.exports = {
  build,
  develop
}
