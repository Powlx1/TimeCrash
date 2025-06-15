"use strict";

document.addEventListener('DOMContentLoaded', () => {
    console.log("Renderer DOM fully loaded");
    console.log("window.api:", window.api);

    const appUsageList = document.getElementById("app-stats");
    const dateSelector = document.getElementById('date-selector');
    const historyAppStatsList = document.getElementById('history-app-stats');

    if (!window.api) {
        console.error("window.api is not defined - check preload script");
        if (appUsageList) appUsageList.innerHTML = "<li>Error: API not loaded</li>";
        if (historyAppStatsList) historyAppStatsList.innerHTML = "<li>Error: API not loaded</li>"; // Also update history list
        return;
    }

    function formatDuration(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    function displayAppUsage(apps) {
        if (!appUsageList) {
            console.error("app-stats element not found");
            return;
        }

        if (!apps || apps.length === 0) {
            appUsageList.innerHTML = "<li>No usage data available.</li>";
            return;
        }

        appUsageList.innerHTML = apps.map(app => `
            <li>
                <strong>${app.name}</strong><br>
                Open Duration: ${formatDuration(app.totalOpenDuration)}<br>
                Active Duration: ${formatDuration(app.totalActiveDuration)}<br>
                <small>Path: ${app.exePath}</small>
            </li>
        `).join('');
    }

    function displayHistoryAppUsage(apps) {
        if (!historyAppStatsList) {
            console.error("history-app-stats element not found");
            return;
        }

        if (!apps || apps.length === 0) {
            historyAppStatsList.innerHTML = "<li>No usage data available for this date.</li>";
            return;
        }

        historyAppStatsList.innerHTML = apps.map(app => `
            <li>
                <strong>${app.name}</strong><br>
                Open Duration: ${formatDuration(app.totalOpenDuration)}<br>
                Active Duration: ${formatDuration(app.totalActiveDuration)}<br>
                <small>Path: ${app.exePath}</small>
            </li>
        `).join('');
    }


    function updateStats() {
        console.log("Calling getAppStats for Live Tracking");
        window.api.getAppStats()
            .then(displayAppUsage)
            .catch(error => console.error('Failed to get app stats:', error));
    }

    async function populateDateDropdown() {
        console.log("Attempting to populate date dropdown...");
        if (!dateSelector) {
            console.error("date-selector element not found. This is a critical error and should not happen if HTML is correct.");
            return;
        }
        try {
            const dates = await window.api.getAvailableDates();
            console.log("Dates received for dropdown:", dates);

            dateSelector.innerHTML = ''; 

            if (dates && dates.length > 0) {
                dates.forEach(date => {
                    const option = document.createElement('option');
                    option.value = date;
                    option.textContent = date;
                    dateSelector.appendChild(option);
                });
                dateSelector.value = dates[0];
                await loadDailyAppStats(dates[0]);
            } else {
                console.log("No dates available from database. Displaying default option.");
                const option = document.createElement('option');
                option.textContent = 'No usage data for specific dates available.';
                option.value = '';
                dateSelector.appendChild(option);
                displayHistoryAppUsage([]);
            }
        } catch (error) {
            console.error('Failed to load available dates:', error);
            dateSelector.innerHTML = '<option value="">Error loading dates</option>';
            displayHistoryAppUsage([]); 
        }
    }

    async function loadDailyAppStats(date) {
        console.log(`Loading daily app stats for date: ${date}`);
        try {
            const dailyStats = await window.api.getDailyAppStats(date);
            displayHistoryAppUsage(dailyStats);
        } catch (error) {
            console.error(`Failed to get daily app stats for ${date}:`, error);
            historyAppStatsList.innerHTML = "<li>Error loading daily stats.</li>";
        }
    }

    if (dateSelector) {
        dateSelector.addEventListener('change', (event) => {
            const selectedDate = event.target.value;
            console.log(`Dropdown date selected: ${selectedDate}`);
            loadDailyAppStats(selectedDate);
        });
    }


    function openTab(tabName) {
        console.log(`--- Opening tab: ${tabName} ---`);
        const tabContents = document.querySelectorAll('.tabcontent');
        const tabLinks = document.querySelectorAll('.tablinks');

        tabContents.forEach(content => content.classList.remove('active'));
        tabLinks.forEach(link => link.classList.remove('active'));

        const targetContent = document.getElementById(tabName);
        const targetLink = document.querySelector(`.tablinks[data-tab="${tabName}"]`);

        if (targetContent && targetLink) {
            targetContent.classList.add('active');
            targetLink.classList.add('active');
            if (tabName === 'Tracking') {
                console.log('Dispatching loadTracking event');
                window.dispatchEvent(new Event('loadTracking'));
            } else if (tabName === 'History') { 
                console.log('Dispatching loadHistory event');
                window.dispatchEvent(new Event('loadHistory'));
            }
        } else {
            console.error(`Tab content or link not found for: ${tabName}`);
        }
    }

    let intervalId = null;

    window.addEventListener('loadTracking', () => {
        console.log("Event 'loadTracking' received. Tracking tab opened, starting stats update");
        updateStats();
        intervalId = setInterval(updateStats, 5000);
    });

    window.addEventListener('loadHistory', () => {
        console.log("Event 'loadHistory' received. History tab opened, populating date dropdown.");
        populateDateDropdown();
    });


    const tabLinks = document.querySelectorAll('.tablinks');
    if (tabLinks.length === 0) {
        console.error("No tablinks found in DOM. This indicates a problem with HTML structure or script loading order.");
    }
    tabLinks.forEach(button => {
        button.addEventListener('click', (evt) => {
            const target = evt.currentTarget;
            const tabName = target.getAttribute('data-tab');
            console.log(`Tab button clicked: ${tabName}`);
            if (tabName) {
                openTab(tabName);
            }
            if (tabName !== 'Tracking' && intervalId) {
                console.log("Leaving Tracking tab, stopping stats update");
                clearInterval(intervalId);
                intervalId = null;
            }
        });
    });

    openTab('Settings');

    window.api.getSettings().then((settings) => {
        if (!settings) {
            console.log("No settings found, showing Settings tab");
            document.getElementById('Settings')?.classList.add('active');
        } else {
            loadSettingsUI(settings);
        }
    });

    const saveButton = document.getElementById('saveInitialSettings');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            console.log("Saving settings");
            const trackWindowTitles = document.getElementById('trackWindowTitles').checked;
            const trackExecutablePaths = document.getElementById('trackExecutablePaths').checked;

            const settings = { trackWindowTitles, trackExecutablePaths };
            window.api.saveSettings(settings);
        });
    } else {
        console.error("saveInitialSettings button not found");
    }

    function loadSettingsUI(settings) {
        const titleCheckbox = document.getElementById('trackWindowTitles');
        const pathCheckbox = document.getElementById('trackExecutablePaths');
        if (titleCheckbox && pathCheckbox) {
            titleCheckbox.checked = settings.trackWindowTitles;
            pathCheckbox.checked = settings.trackExecutablePaths;
        } else {
            console.error("Settings checkboxes not found");
        }
    }
});