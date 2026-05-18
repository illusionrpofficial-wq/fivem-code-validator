local vehicle = 0

CreateThread(function()
  while true do
    TriggerServerEvent('ping')
  end
end)

---@diagnostic disable-next-line: missing-parameter
SetVehicleNumberPlateText(vehicle)

RegisterNUICallback('buy', function(data, cb)
  TriggerServerEvent('shop:buy', data.item, data.price)
  cb({})
end)