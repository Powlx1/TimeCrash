"use strict";
console.log("hello from the renderer");
const appUsageList = document.getElementById("app-usage-list");
window.api.getAppUsage().then((appUsage) => {
    if (appUsageList) {
        appUsageList.innerHTML = appUsage.map(app => `<li>${app.name}: ${app.duration} ms</li>`).join('');
    }
}).catch((error) => console.error('Failed to get app usage:', error));
window.api.logActivity('Visual Studio Code', 120, new Date().toISOString())
    .then(response => console.log('Activity logged with ID:', response.id))
    .catch(error => console.error('Failed to log activity:', error));
