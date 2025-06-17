"use strict";

document.addEventListener('DOMContentLoaded', () => {
    console.log("Renderer DOM fully loaded");
    console.log("window.api:", window.api);

    const appUsageList = document.getElementById("app-stats");
    const dateSelector = document.getElementById('date-selector');
    const historyAppStatsList = document.getElementById('history-app-stats');
    const trackWindowTitlesCheckbox = document.getElementById('trackWindowTitles');
    const trackExecutablePathsCheckbox = document.getElementById('trackExecutablePaths');
    const saveInitialSettingsButton = document.getElementById('saveInitialSettings');

    if (!window.api) {
        console.error("window.api is not defined - check preload script");
        if (appUsageList) appUsageList.innerHTML = "<li>Error: API not loaded</li>";
        if (historyAppStatsList) historyAppStatsList.innerHTML = "<li>Error: API not loaded</li>";
        return;
    }

    let activityChart = null;

    function formatDuration(ms) {
        if (ms === 0) return "0s";
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

        return parts.join(' ');
    }

    function createUsageDiagram(openDuration, activeDuration, maxDuration) {
        if (maxDuration === 0) {
            return `
                <div class="diagram-container">
                    <div class="diagram-bar" style="width: 0%;">
                        <div class="diagram-bar-active" style="width: 0%;"></div>
                    </div>
                </div>
            `;
        }

        const openPercentage = (openDuration / maxDuration) * 100;
        const activePercentageOfOpen = (openDuration > 0) ? (activeDuration / openDuration) * 100 : 0;

        return `
            <div class="diagram-container">
                <div class="diagram-bar" style="width: ${openPercentage.toFixed(2)}%;">
                    <div class="diagram-bar-active" style="width: ${activePercentageOfOpen.toFixed(2)}%;"></div>
                </div>
            </div>
        `;
    }

    function createActivityRing(openDuration, activeDuration) {
        const size = 60; 
        const strokeWidth = 8;
        const radius = (size / 2) - (strokeWidth / 2);
        const circumference = 2 * Math.PI * radius;

        const activePercentage = (openDuration > 0) ? (activeDuration / openDuration) * 100 : 0;
        const activeStrokeDashoffset = circumference - (activePercentage / 100) * circumference;

        return `
            <div class="activity-ring-container">
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="transform -rotate-90">
                    <!-- Background ring (total open duration) -->
                    <circle
                        class="activity-ring-background"
                        stroke-width="${strokeWidth}"
                        fill="transparent"
                        r="${radius}"
                        cx="${size / 2}"
                        cy="${size / 2}"
                    />
                    <!-- Foreground ring (active duration) -->
                    <circle
                        class="activity-ring-foreground"
                        stroke-width="${strokeWidth}"
                        fill="transparent"
                        r="${radius}"
                        cx="${size / 2}"
                        cy="${size / 2}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${activeStrokeDashoffset}"
                    />
                </svg>
                <div class="center-text">
                    ${activePercentage.toFixed(0)}%
                </div>
            </div>
        `;
    }

    function renderAppStats(apps, targetListElement) {
        if (!targetListElement) {
            console.error("Target list element is null.");
            return;
        }
        targetListElement.innerHTML = '';

        if (!apps || apps.length === 0) {
            targetListElement.innerHTML = '<li style="text-align: center; color: var(--text-secondary);">No application usage data for this period.</li>';
            return;
        }

        apps.sort((a, b) => b.totalOpenDuration - a.totalOpenDuration);
        const maxOpenDuration = Math.max(...apps.map(app => app.totalOpenDuration));

        apps.forEach(app => {
            const listItem = document.createElement('li');
            listItem.className = 'app-stat-item'; 

            let detail = '';
            const currentTrackWindowTitles = trackWindowTitlesCheckbox ? trackWindowTitlesCheckbox.checked : true;
            const currentTrackExecutablePaths = trackExecutablePathsCheckbox ? trackExecutablePathsCheckbox.checked : true;

            if (currentTrackExecutablePaths && app.exePath) {
                detail += `<small>Path: ${app.exePath}</small>`;
            }
            if (currentTrackWindowTitles && app.lastTitle && app.lastTitle !== app.name) {
                detail += `<small>Last Title: ${app.lastTitle}</small>`;
            }

            const diagramHtml = createUsageDiagram(app.totalOpenDuration, app.totalActiveDuration, maxOpenDuration);
            const activityRingHtml = createActivityRing(app.totalOpenDuration, app.totalActiveDuration);

            listItem.innerHTML = `
                <div class="app-details-container">
                    <strong>${app.name || 'Unknown Application'}</strong>
                    <p>Open: ${formatDuration(app.totalOpenDuration)}</p>
                    <p>Active: ${formatDuration(app.totalActiveDuration)}</p>
                    ${detail}
                </div>
                <div class="app-diagrams-container">
                    ${activityRingHtml}
                    ${diagramHtml}
                </div>
            `;
            targetListElement.appendChild(listItem);
        });
    }

    function renderDailyOverview(dailyStats) {
        let totalOpen = 0;
        let totalActive = 0;

        dailyStats.forEach(app => {
            totalOpen += app.totalOpenDuration;
            totalActive += app.totalActiveDuration;
        });

        const totalOpenElement = document.getElementById('total-open-duration');
        const totalActiveElement = document.getElementById('total-active-duration');
        const totalActiveBar = document.querySelector('#daily-overview-chart .diagram-bar-total-active');

        if (totalOpenElement) totalOpenElement.textContent = formatDuration(totalOpen);
        if (totalActiveElement) totalActiveElement.textContent = formatDuration(totalActive);

        if (totalActiveBar && totalOpen > 0) {
            const activePercentage = (totalActive / totalOpen) * 100;
            totalActiveBar.style.width = `${activePercentage.toFixed(2)}%`;
        } else if (totalActiveBar) {
            totalActiveBar.style.width = '0%'; 
        }
    }

    function renderLiveTimelineChart(apps) {
        const ctx = document.getElementById('activityChart')?.getContext('2d');
        if (!ctx) {
            console.error("Canvas element for activityChart not found.");
            return;
        }

        apps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const appNames = apps.map(app => app.name || 'Unknown');
        const openDurations = apps.map(app => app.totalOpenDuration);
        const activeDurations = apps.map(app => app.totalActiveDuration);

        if (activityChart) {
            activityChart.data.labels = appNames;
            activityChart.data.datasets[0].data = openDurations;
            activityChart.data.datasets[1].data = activeDurations;
            activityChart.update();
        } else {
            activityChart = new Chart(ctx, {
                type: 'bar', 
                data: {
                    labels: appNames,
                    datasets: [
                        {
                            label: 'Total Open Duration',
                            data: openDurations,
                            backgroundColor: 'rgba(0, 123, 255, 0.7)', 
                            borderColor: 'rgba(0, 86, 179, 1)', 
                            borderWidth: 1
                        },
                        {
                            label: 'Total Active Duration',
                            data: activeDurations,
                            backgroundColor: 'rgba(40, 167, 69, 0.7)',
                            borderColor: 'rgba(29, 115, 48, 1)', 
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    indexAxis: 'y', 
                    responsive: true,
                    maintainAspectRatio: false, 
                    scales: {
                        x: {
                            beginAtZero: true,
                            stacked: false, 
                            title: {
                                display: true,
                                text: 'Duration',
                                color: '#FFFFFF' 
                            },
                            ticks: {
                                callback: function(value, index, values) {
                                    return formatDuration(value); 
                                },
                                color: '#FFFFFF' 
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)' 
                            }
                        },
                        y: {
                            stacked: false,
                            title: {
                                display: true,
                                text: 'Application',
                                color: '#FFFFFF'
                            },
                            ticks: {
                                color: '#FFFFFF'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)' 
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                color: '#FFFFFF' 
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.x !== null) {
                                        label += formatDuration(context.parsed.x);
                                    }
                                    return label;
                                }
                            },
                            titleColor: '#FFFFFF',
                            bodyColor: '#FFFFFF', 
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderWidth: 1,
                            backgroundColor: 'rgba(0, 0, 0, 0.7)' 
                        }
                    }
                }
            });
        }
    }

    function updateStats() {
        console.log("Calling getAppStats for Live Tracking");
        window.api.getAppStats()
            .then(data => {
                renderAppStats(data, appUsageList);
                renderLiveTimelineChart(data);
            })
            .catch(error => console.error('Failed to get live app stats:', error));
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
                renderAppStats([], historyAppStatsList); 
                renderDailyOverview([]);
            }
        } catch (error) {
            console.error('Failed to load available dates:', error);
            dateSelector.innerHTML = '<option value="">Error loading dates</option>';
            renderAppStats([], historyAppStatsList);
            renderDailyOverview([]);
        }
    }

    async function loadDailyAppStats(date) {
        console.log(`Loading daily app stats for date: ${date}`);
        try {
            const dailyStats = await window.api.getDailyAppStats(date);
            renderAppStats(dailyStats, historyAppStatsList);
            renderDailyOverview(dailyStats);
        } catch (error) {
            console.error(`Failed to get daily app stats for ${date}:`, error);
            historyAppStatsList.innerHTML = "<li>Error loading daily stats.</li>";
            renderDailyOverview([]); 
        }
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
        if (intervalId) clearInterval(intervalId);
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

    function loadSettingsUI(settings) {
        const titleCheckbox = document.getElementById('trackWindowTitles');
        const pathCheckbox = document.getElementById('trackExecutablePaths');
        if (titleCheckbox && pathCheckbox) {
            titleCheckbox.checked = settings.trackWindowTitles;
            pathCheckbox.checked = settings.trackExecutablePaths;
        } else {
            console.error("Settings checkboxes not found.");
        }
    }

    window.api.getSettings().then((settings) => {
        if (!settings) {
            console.log("No settings found, showing Settings tab (initial load)");
        } else {
            loadSettingsUI(settings);
        }
    }).catch(error => {
        console.error("Error fetching initial settings:", error);
    });

    const saveButton = document.getElementById('saveInitialSettings');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            console.log("Saving settings...");
            const trackWindowTitles = (document.getElementById('trackWindowTitles')).checked;
            const trackExecutablePaths = (document.getElementById('trackExecutablePaths')).checked;

            const settings = { trackWindowTitles, trackExecutablePaths };
            window.api.saveSettings(settings)
                .then(() => console.log('Settings saved and IPC sent successfully.'))
                .catch(error => console.error('Error saving settings via IPC:', error));
        });
    } else {
        console.error("saveInitialSettings button not found.");
    }

    if (dateSelector) {
        dateSelector.addEventListener('change', (event) => {
            const selectedDate = event.target.value;
            console.log(`Dropdown date selected: ${selectedDate}`);
            loadDailyAppStats(selectedDate);
        });
    }
});
