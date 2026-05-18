---@diagnostic disable: missing-parameter, param-type-mismatch

fx_version 'cerulean'
game 'gta5'

client_scripts {
  'client.lua'
}

server_scripts {
  'server.lua'
}

shared_scripts {
  'shared.lua',
  'config.lua'
}

ui_page 'web/index.html'

files {
  'web/index.html',
  'web/app.js'
}

exports {
  'OpenMenu'
}