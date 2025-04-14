/**
 * main.js
 * Entry point for the application.
 * Initializes components and sets up event listeners.
 */

// Import modules
import { fetchMeetings, fetchRooms, fetchUsers, fetchDashboardStats } from './controllers/data-loader.js';
import { attachActionListeners, attachNewMeetingListener, attachSearchAndFilterListeners } from './controllers/event-handlers.js';
import { showInfo } from './utils/notifications.js';

// DOM elements
const contentSections = document.querySelectorAll('.content-section');
const navLinks = document.querySelectorAll('.sidebar-nav a');

/**
 * Initialize the application
 */
function initApp() {
    console.log('Initializing application...');
    
    // Load initial data
    loadContentForCurrentSection();
    
    // Set up navigation
    setupNavigation();
    
    // Show welcome message
    showWelcomeMessage();
}

/**
 * Set up navigation between sections
 */
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the section ID from the URL
            const sectionId = this.getAttribute('href').split('=')[1];
            
            // Update the URL without reload
            window.history.pushState({}, '', this.getAttribute('href'));
            
            // Show the selected section
            showSection(sectionId);
            
            // Update active navigation link
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Handle back/forward browser buttons
    window.addEventListener('popstate', () => {
        loadContentForCurrentSection();
    });
}

/**
 * Show a specific content section
 * @param {string} sectionId - The ID of the section to show
 */
function showSection(sectionId) {
    console.log(`Showing section: ${sectionId}`);
    
    // Hide all sections
    contentSections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Show the selected section
    const targetSection = document.getElementById(`content-${sectionId}`);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Load content for the section if needed
        loadSectionContent(sectionId);
    } else {
        // Fallback to first section if target doesn't exist
        document.getElementById('content-1').classList.add('active');
        loadSectionContent('1');
    }
}

/**
 * Load content for the current section based on URL
 */
function loadContentForCurrentSection() {
    // Get section ID from URL or default to '1'
    const urlParams = new URLSearchParams(window.location.search);
    const sectionId = urlParams.get('id') || '1';
    
    // Show the appropriate section
    showSection(sectionId);
    
    // Update active navigation link
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(`id=${sectionId}`)) {
            link.classList.add('active');
        }
    });
}

/**
 * Load content for a specific section
 * @param {string} sectionId - The ID of the section
 */
function loadSectionContent(sectionId) {
    switch (sectionId) {
        case '1': // 会议管理
            fetchMeetings();
            attachActionListeners();
            attachNewMeetingListener();
            attachSearchAndFilterListeners();
            break;
        
        case '2': // 文件管理
            // TODO: Implement file management functionality
            console.log('File management section - to be implemented');
            break;
        
        case '3': // 用户管理
            fetchUsers();
            // Attach user-specific event handlers if needed
            break;
        
        case '4': // 统计分析
            fetchDashboardStats();
            // Initialize charts if needed
            break;
        
        case '5': // 系统设置
            // Load settings if needed
            console.log('Settings section - to be implemented');
            break;
        
        default:
            console.warn(`Unknown section ID: ${sectionId}`);
    }
}

/**
 * Display a welcome message to the user
 */
function showWelcomeMessage() {
    setTimeout(() => {
        const now = new Date();
        const hours = now.getHours();
        let greeting = '';
        
        if (hours < 12) {
            greeting = '早上好';
        } else if (hours < 18) {
            greeting = '下午好';
        } else {
            greeting = '晚上好';
        }
        
        showInfo(`${greeting}，欢迎使用无纸化会议系统。`);
    }, 1500);
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);

// Export functions for potential use by other modules
export { showSection };
