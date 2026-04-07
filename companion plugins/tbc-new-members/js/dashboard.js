document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    initializeSectionToggles();
});

function initializeCharts() {
    const ctx = document.getElementById('activityChart');
    if (!ctx || !window.dashboardData) return;

    const data = processChartData(window.dashboardData.historical);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Posts',
                    data: data.posts,
                    borderColor: '#2271b1',
                    backgroundColor: 'rgba(34, 113, 177, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Comments',
                    data: data.comments,
                    borderColor: '#46b450',
                    backgroundColor: 'rgba(70, 180, 80, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Reactions',
                    data: data.reactions,
                    borderColor: '#dc3232',
                    backgroundColor: 'rgba(220, 50, 50, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 13 }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12 },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        font: { size: 12 },
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function processChartData(data) {
    return {
        labels: data.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }),
        posts: data.map(item => item.posts),
        comments: data.map(item => item.comments),
        reactions: data.map(item => item.reactions)
    };
}

function initializeSectionToggles() {
    const headers = document.querySelectorAll('.section-header');
    headers.forEach(header => {
        const panel = header.closest('.dashboard-panel');
        if (!panel) return;
        const wrapper = panel.querySelector('.section-wrapper');
        const toggleBtn = header.querySelector('button');
        if (!wrapper || !toggleBtn) return;

        header.addEventListener('click', function() {
            if (wrapper.classList.contains('collapsed')) {
                wrapper.classList.remove('collapsed');
                toggleBtn.querySelector('.toggle-icon').textContent = '−';
            } else {
                wrapper.classList.add('collapsed');
                toggleBtn.querySelector('.toggle-icon').textContent = '+';
            }
        });
    });
}
