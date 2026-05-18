local function DoSomething() end

-- fivem-check-disable event-prefix-check
-- fivem-check-disable-next-line no-loop-without-wait
while true do
  DoSomething()
end

RegisterNetEvent('bad:event')