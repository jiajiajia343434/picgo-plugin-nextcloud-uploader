// const logger = require('@varnxy/logger')
// logger.setDirectory('/Users/gph/Library/Application Support/picgo/picgo-plugin-nextcloud-uploader/logs')
// let log = logger('plugin')
module.exports = (ctx) => {
  const register = () => {
    ctx.helper.uploader.register('nextcloud-uploader', {
      handle: uploader,
      name: 'NextCloud图床',
      config: config
    })
  }
  const config = ctx => {
    let userConfig = ctx.getConfig('picBed.nextcloud-uploader')
    if (!userConfig) {
      userConfig = {}
    }
    return [
      {
        name: 'host',
        type: 'input',
        default: userConfig.host,
        required: true,
        message: '服务地址',
        alias: '服务地址'
      },
      {
        name: 'user',
        type: 'input',
        default: userConfig.user,
        required: true,
        message: '用户名',
        alias: '用户名'
      },
      {
        name: 'password',
        type: 'password',
        default: userConfig.password,
        required: true,
        message: '密码',
        alias: '密码'
      },
      {
        name: 'path',
        type: 'input',
        default: userConfig.path,
        required: false,
        message: '自定义保存路径',
        alias: '保存路径'
      }
    ]
  }
  const uploader = async function (ctx) {
    let userConfig = ctx.getConfig('picBed.nextcloud-uploader')
    if (!userConfig) {
      throw new Error(`未配置参数，请先配置nextcloud上传参数`)
    }
    const host = userConfig.host
    const path = userConfig.path
    const user = userConfig.user
    const password = userConfig.password
    try {
      let imgList = ctx.output
      for (let i in imgList) {
        let image = imgList[i]
        let data = image.buffer
        if (!data && image.base64Image) {
          data = Buffer.from(image.base64Image, 'base64')
        }
        let contentType = mimeTypes[image.extname] || 'application/octet-stream'
        // let contentType = mime.lookup(image.fileName)
        const publicHeaders = {
          'OCS-APIREQUEST': 'true',
          'User-Agent': 'PicGo',
          'Accept': 'application/json'
        }
        const auth = {
          'user': user,
          'password': password,
          'sendImmediately': true
        }
        await ctx.Request.request({
          method: 'put',
          url: `${host}/remote.php/dav/files/${user}/${encodeURI(path)}/${encodeURI(image.fileName)}`,
          auth: auth,
          headers: {
            ...publicHeaders,
            'Content-Disposition': `attachment; filename="${encodeURI(image.fileName)}"`,
            'Content-Type': contentType
          },
          body: data
        })
        // log.info('NextCloud上传成功,开始设置公开链接...')
        let body = await ctx.Request.request({
          method: 'post',
          url: `${host}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
          headers: {
            ...publicHeaders
          },
          auth: auth,
          formData: {
            path: `${path}/${image.fileName}`,
            shareType: 3
          }
        })
        // log.info('共享成功：' + body)
        // log.info('返回内容：' + JSON.parse(body))
        delete image.base64Image
        delete image.buffer
        body = JSON.parse(body).ocs
        if (body.meta.statuscode === 200) {
          image.imgUrl = body.data.url + '/preview'
          ctx.emit('notification', {
            title: '上传成功',
            body: '可以粘贴链接啦...'
          })
        } else {
          await ctx.Request.request({
            method: 'delete',
            url: `${host}/remote.php/dav/files/${user}/${encodeURI(path)}/${encodeURI(image.fileName)}`,
            auth: auth,
            headers: {
              ...publicHeaders
            }
          })
          ctx.emit('notification', {
            title: '共享失败',
            body: 'NextCloud设置共享失败，请检查NextCloud设置'
          })
        }
      }
    } catch (err) {
      // log.error(`上传失败：${err.stack}`)
      if (err.message.indexOf('404') === 0) {
        ctx.emit('notification', {
          title: '上传失败',
          body: '路径不存在，请检查路径设置'
        })
      } else {
        ctx.emit('notification', {
          title: '上传失败',
          body: err.message
        })
      }
    }
  }
  const mimeTypes = {
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.tiff': 'image/tiff'
  }
  return {
    register,
    uploader: 'nextcloud-uploader'
  }
}
