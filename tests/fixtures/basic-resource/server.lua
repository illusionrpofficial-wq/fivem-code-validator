local xPlayer = {
  addMoney = function(...) end
}

local MySQL = {
  query = function(...) end
}

local lib = {
  callback = {
    register = function(...) end
  }
}

PlayerPedId()

RegisterNetEvent('giveMoney')
AddEventHandler('giveMoney', function(amount)
  xPlayer.addMoney(amount)
end)

RegisterNetEvent('job:reward')
AddEventHandler('job:reward', function(amount)
  xPlayer.addMoney(amount)
end)

RegisterNetEvent('inventory:grant')
AddEventHandler('inventory:grant', function(item, count)
  exports.ox_inventory:AddItem(source, item, count)
end)

RegisterNetEvent('lookup:user')
AddEventHandler('lookup:user', function(identifier)
  MySQL.query('SELECT * FROM users WHERE identifier = ' .. identifier)
end)

lib.callback.register('shop:getPrice', function(source, item)
  return item
end)

print(json.encode({ amount = 1 }))

MySQL.query('SELECT * FROM users WHERE id = ' .. source)

exports.ox_inventory:AddItem(source, 'water', 1)