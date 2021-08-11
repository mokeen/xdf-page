#!/usr/bin/env node

process.argv.push('--cwd')
// 工作目录就是当前执行包命令的目录
process.argv.push(process.cwd())
process.argv.push('--gulpfile')
// 直接跳出到根目录，它会在package.json查找main字段，找到入口文件
process.argv.push(require.resolve('..'))

require('gulp/bin/gulp')
