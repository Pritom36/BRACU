document.addEventListener('DOMContentLoaded', function() {
    // Auth state with session management
    let isLoggedIn = false;
    let currentSession = null;
    let sessionCheckInterval = null;
    let users = null;

    // Load users data from JSON file
    async function loadUsers() {
        try {
            const response = await fetch('api/private/users.json');
            if (!response.ok) {
                throw new Error('Failed to load users data');
            }
            users = await response.json();
            return users;
        } catch (error) {
            console.error('Error loading users:', error);
            showAlert('Error loading user data. Please try again later.', true);
        }
    }

    // Initialize by loading users
    loadUsers().then(() => {
        checkSession();
        renderQuestions(currentPage);
    });

    // Hash function for PINs with fallback
    async function hashPin(pin) {
        // Try using Web Crypto API first
        try {
            if (window.crypto && window.crypto.subtle) {
                const msgBuffer = new TextEncoder().encode(pin);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) {
            console.warn('Web Crypto API not available, using fallback hash');
        }

        // Fallback simple hashing algorithm
        let hash = 0;
        for (let i = 0; i < pin.length; i++) {
            const char = pin.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    // Check if date is expired with proper validation
    function isDateExpired(dateStr) {
        const expiryDate = new Date(dateStr);
        const currentDate = new Date('2025-04-06'); // Current date (April 6, 2025)
        
        // Check if date is valid
        if (isNaN(expiryDate.getTime())) {
            console.error('Invalid date format:', dateStr);
            return true; // Consider invalid dates as expired
        }
        
        // Compare dates
        return currentDate > expiryDate;
    }

    // Generate Device ID
    function generateDeviceId() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        const deviceId = `${userAgent}-${platform}-${window.innerWidth}x${window.innerHeight}`;
        return btoa(deviceId);
    }

    // Start session monitoring
    function startSessionMonitoring(user) {
        // Clear any existing interval
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
        }

        // Create session
        currentSession = {
            username: user.username,
            deviceId: generateDeviceId(),
            expiryDate: user.expiryDate,
            lastActivity: new Date().getTime()
        };

        // Check session every 30 seconds
        sessionCheckInterval = setInterval(() => {
            checkSession();
        }, 30000);
    }

    // Check session validity
    async function checkSession() {
        if (!currentSession) {
            handleLogout();
            return;
        }

        // Reload users data to get latest changes
        await loadUsers();

        // Check expiry date
        if (isDateExpired(currentSession.expiryDate)) {
            showAlert('Your PIN has expired. Please log in again.', true);
            handleLogout();
            return;
        }

        // Check if device ID still matches
        if (currentSession.deviceId !== generateDeviceId()) {
            showAlert('Session invalidated due to device change.', true);
            handleLogout();
            return;
        }

        // Check if user is still active
        const user = users.users.find(u => u.username === currentSession.username);
        if (!user || !user.isActive) {
            showAlert('Your account has been deactivated.', true);
            handleLogout();
            return;
        }

        // Update last activity
        currentSession.lastActivity = new Date().getTime();
    }

    // Handle logout
    function handleLogout() {
        isLoggedIn = false;
        currentSession = null;
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }
        renderQuestions(currentPage);
    }

    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu');
    const navMenu = document.querySelector('nav ul');
    
    mobileMenuBtn.addEventListener('click', function() {
        navMenu.classList.toggle('show');
    });
    
    // Login Modal
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');

    // Alert function with dynamic styling
    function showAlert(message, isError = false) {
        const alert = document.createElement('div');
        alert.className = 'alert';
        alert.innerHTML = `
            <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(alert);
        setTimeout(() => alert.classList.add('show'), 100);
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }

    // Handle login form submission with proper PIN validation
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Reload users data to get latest changes
        await loadUsers();
        
        const username = document.getElementById('username').value;
        const pin = document.getElementById('secretPin').value;

        const user = users.users.find(u => u.username === username);
        
        if (!user) {
            showAlert('Invalid username or PIN!', true);
            return;
        }

        if (!user.isActive) {
            showAlert('This account has been disabled!', true);
            return;
        }

        if (isDateExpired(user.expiryDate)) {
            showAlert('Your PIN has expired!', true);
            return;
        }

        // Hash the input PIN and compare with stored hash
        const hashedPin = await hashPin(pin);
        if (user.pin !== hashedPin) {
            showAlert('Invalid username or PIN!', true);
            return;
        }

        const deviceId = generateDeviceId();
        if (user.deviceId && user.deviceId !== deviceId) {
            showAlert('This PIN is already in use on another device!', true);
            return;
        }

        // Login successful
        user.deviceId = deviceId;
        isLoggedIn = true;
        startSessionMonitoring(user);
        loginModal.classList.remove('show');
        showAlert('Successfully logged in!');
        renderQuestions(currentPage);
    });

    // Smooth Scrolling for Navigation Links
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                navMenu.classList.remove('show');
            }
        });
    });
    
    // Header Scroll Effect
    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
    
    // Initialize header state
    if (window.scrollY > 50) {
        document.querySelector('header').classList.add('scrolled');
    }
    
    // Load Model Questions
    const questionsContainer = document.getElementById('questions-container');
    const pageNumbers = document.getElementById('page-numbers');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    const questionsPerPage = 9;
    let currentPage = 1;
    
    // Generate 30 model questions
    const totalQuestions = 30;
    const questions = [];
    
    for (let i = 1; i <= totalQuestions; i++) {
        questions.push({
            id: i,
            title: `Model Question ${i}`,
        });
    }
    
    // Render Questions with secure access
    function renderQuestions(page) {
        questionsContainer.innerHTML = '';
        
        const startIndex = (page - 1) * questionsPerPage;
        const endIndex = Math.min(startIndex + questionsPerPage, questions.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const question = questions[i];
            const isLocked = question.id !== 1 && !isLoggedIn;
            
            const questionCard = document.createElement('div');
            questionCard.className = `question-card ${isLocked ? 'locked' : ''}`;
            
            questionCard.innerHTML = `
                <a href="${isLocked ? '#' : `model-questions/model-${question.id}.html`}" 
                   ${isLocked ? 'data-question-id="' + question.id + '"' : ''}>
                    <div class="question-content">
                        <h3>${question.title}</h3>
                        <span class="view-btn">View Question</span>
                    </div>
                </a>
            `;
            
            if (isLocked) {
                questionCard.querySelector('a').addEventListener('click', function(e) {
                    e.preventDefault();
                    loginModal.classList.add('show');
                    showAlert('Please login to access this model question!', true);
                });
            }
            
            questionsContainer.appendChild(questionCard);
        }
        
        // Update pagination buttons
        prevPageBtn.disabled = page === 1;
        nextPageBtn.disabled = page === Math.ceil(questions.length / questionsPerPage);
        
        updatePageNumbers(page);
    }
    
    // Update Page Numbers
    function updatePageNumbers(currentPage) {
        pageNumbers.innerHTML = '';
        
        const totalPages = Math.ceil(questions.length / questionsPerPage);
        const maxVisiblePages = 5;
        let startPage, endPage;
        
        if (totalPages <= maxVisiblePages) {
            startPage = 1;
            endPage = totalPages;
        } else {
            const maxPagesBeforeCurrent = Math.floor(maxVisiblePages / 2);
            const maxPagesAfterCurrent = Math.ceil(maxVisiblePages / 2) - 1;
            
            if (currentPage <= maxPagesBeforeCurrent) {
                startPage = 1;
                endPage = maxVisiblePages;
            } else if (currentPage + maxPagesAfterCurrent >= totalPages) {
                startPage = totalPages - maxVisiblePages + 1;
                endPage = totalPages;
            } else {
                startPage = currentPage - maxPagesBeforeCurrent;
                endPage = currentPage + maxPagesAfterCurrent;
            }
        }
        
        // Add first page and ellipsis if needed
        if (startPage > 1) {
            addPageNumber(1);
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                pageNumbers.appendChild(ellipsis);
            }
        }
        
        // Add page numbers in range
        for (let i = startPage; i <= endPage; i++) {
            addPageNumber(i);
        }
        
        // Add last page and ellipsis if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                pageNumbers.appendChild(ellipsis);
            }
            addPageNumber(totalPages);
        }
        
        function addPageNumber(page) {
            const pageNumber = document.createElement('span');
            pageNumber.className = 'page-number';
            pageNumber.textContent = page;
            
            if (page === currentPage) {
                pageNumber.classList.add('active');
            }
            
            pageNumber.addEventListener('click', function() {
                if (page !== currentPage) {
                    currentPage = page;
                    renderQuestions(currentPage);
                    window.scrollTo({ top: questionsContainer.offsetTop - 100, behavior: 'smooth' });
                }
            });
            
            pageNumbers.appendChild(pageNumber);
        }
    }
    
    // Pagination Event Listeners
    prevPageBtn.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderQuestions(currentPage);
            window.scrollTo({ top: questionsContainer.offsetTop - 100, behavior: 'smooth' });
        }
    });
    
    nextPageBtn.addEventListener('click', function() {
        if (currentPage < Math.ceil(questions.length / questionsPerPage)) {
            currentPage++;
            renderQuestions(currentPage);
            window.scrollTo({ top: questionsContainer.offsetTop - 100, behavior: 'smooth' });
        }
    });
    
    // Initialize with auth check
    checkSession();
    renderQuestions(currentPage);
    
    // Animate elements when scrolling
    const animateOnScroll = function() {
        const elements = document.querySelectorAll('.feature-card, .question-card, .about-image, .contact-form');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementPosition < windowHeight - 100) {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }
        });
    };
    
    // Set initial state for animation
    document.querySelectorAll('.feature-card, .question-card, .about-image, .contact-form').forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });
    
    window.addEventListener('scroll', animateOnScroll);
    animateOnScroll(); // Run once on load
    
    // Search functionality
    const searchBox = document.querySelector('.search-box input');
    searchBox.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length > 0) {
            const filteredQuestions = questions.filter(question => 
                question.title.toLowerCase().includes(searchTerm) || 
                question.department.toLowerCase().includes(searchTerm) ||
                question.semester.toLowerCase().includes(searchTerm)
            );
            
            // Temporarily replace questions with filtered ones
            const originalQuestions = [...questions];
            questions.length = 0;
            questions.push(...filteredQuestions);
            
            renderQuestions(1);
            
            // Restore original questions
            questions.length = 0;
            questions.push(...originalQuestions);
        } else {
            renderQuestions(currentPage);
        }
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === loginModal) {
            loginModal.classList.remove('show');
        }
    });

    // Modify logout button event listener
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn secondary';
    logoutBtn.textContent = 'Logout';
    logoutBtn.style.marginLeft = '15px';
    logoutBtn.addEventListener('click', function() {
        handleLogout();
        showAlert('Successfully logged out!');
    });

    // Add logout button to navigation
    document.querySelector('nav ul').appendChild(document.createElement('li')).appendChild(logoutBtn);

    // Add beforeunload event listener to clear session when closing/refreshing
    window.addEventListener('beforeunload', function() {
        handleLogout();
    });
});

