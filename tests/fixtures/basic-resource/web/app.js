const data = { name: window.location.hash.slice(1) };
document.querySelector('#app').innerHTML = data.name;