// Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBuiIx3dwGCkmL6EEx6bUlVdT32159e3bY",
  authDomain: "pickleball-system.firebaseapp.com",
  projectId: "pickleball-system",
  storageBucket: "pickleball-system.firebasestorage.app",
  messagingSenderId: "561858778455",
  appId: "1:561858778455:web:c7b1c9c96e02eb3deeda12",
  measurementId: "G-2LSN7YYQ7T"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const closeModal = document.querySelector('.close');
const switchToRegister = document.getElementById('switchToRegister');
const switchToLogin = document.getElementById('switchToLogin');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginSubmit = document.getElementById('loginSubmit');
const registerSubmit = document.getElementById('registerSubmit');
const accountBtn = document.getElementById('accountBtn');

// Check if user is logged in
auth.onAuthStateChanged(function(user) {
    if (user) {
        // User is signed in
        console.log('User is signed in:', user.email);
        
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (accountBtn) accountBtn.style.display = 'inline-block';
        
        // Check if user is admin
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists && doc.data().isAdmin) {
                // Add admin link to nav if not already there
                const nav = document.querySelector('nav ul');
                if (nav && !document.getElementById('adminLink')) {
                    const adminLi = document.createElement('li');
                    const adminA = document.createElement('a');
                    adminA.href = 'admin.html';
                    adminA.textContent = 'Admin Panel';
                    adminA.id = 'adminLink';
                    adminLi.appendChild(adminA);
                    nav.appendChild(adminLi);
                }
            }
        });

        // Load user-specific data like their bookings
        loadUserData(user.uid);
        
    } else {
        // User is signed out
        console.log('User is signed out');
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (registerBtn) registerBtn.style.display = 'inline-block';
        if (accountBtn) accountBtn.style.display = 'none';
        
        // Remove admin link if it exists
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.parentElement.remove();
    }
    
    // Load public data regardless of auth state
    loadEvents();
});

// Modal functionality
if (loginBtn) {
    loginBtn.addEventListener('click', function() {
        authModal.style.display = 'block';
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    });
}

if (registerBtn) {
    registerBtn.addEventListener('click', function() {
        authModal.style.display = 'block';
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });
}

if (closeModal) {
    closeModal.addEventListener('click', function() {
        authModal.style.display = 'none';
    });
}

// Switch between login and register forms
if (switchToRegister) {
    switchToRegister.addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });
}

if (switchToLogin) {
    switchToLogin.addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    });
}

// Authentication functionality
if (loginSubmit) {
    loginSubmit.addEventListener('click', function() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in
                const user = userCredential.user;
                authModal.style.display = 'none';
                alert('Logged in successfully!');
            })
            .catch((error) => {
                alert('Error: ' + error.message);
            });
    });
}

if (registerSubmit) {
    registerSubmit.addEventListener('click', function() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const phone = document.getElementById('registerPhone').value;
        
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in 
                const user = userCredential.user;
                
                // Store additional user info in Firestore
                return db.collection('users').doc(user.uid).set({
                    name: name,
                    email: email,
                    phone: phone,
                    isAdmin: false, // Default is not admin
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            })
            .then(() => {
                authModal.style.display = 'none';
                alert('Registration successful!');
            })
            .catch((error) => {
                alert('Error: ' + error.message);
            });
    });
}

// Logout functionality
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        auth.signOut().then(() => {
            alert('You have been logged out');
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Error signing out:', error);
        });
    });
}

// Load upcoming events
function loadEvents() {
    const eventsContainer = document.getElementById('events-container');
    if (!eventsContainer) return;
    
    // Clear existing content
    eventsContainer.innerHTML = '<p>Loading upcoming events...</p>';
    
    const today = new Date();
    
    // Get both courts and classes
    Promise.all([
        db.collection('courts')
            .where('date', '>=', today)
            .orderBy('date')
            .limit(5)
            .get(),
        db.collection('classes')
            .where('date', '>=', today)
            .orderBy('date')
            .limit(5)
            .get()
    ]).then(([courtSnapshot, classSnapshot]) => {
        let events = [];
        
        courtSnapshot.forEach(doc => {
            const data = doc.data();
            events.push({
                type: 'court',
                id: doc.id,
                date: data.date.toDate(),
                time: data.time,
                location: data.location,
                availableSpots: data.availableSpots
            });
        });
        
        classSnapshot.forEach(doc => {
            const data = doc.data();
            events.push({
                type: 'class',
                id: doc.id,
                name: data.name,
                date: data.date.toDate(),
                time: data.time,
                location: data.location,
                availableSpots: data.availableSpots
            });
        });
        
        // Sort events by date
        events.sort((a, b) => a.date - b.date);
        
        if (events.length === 0) {
            eventsContainer.innerHTML = '<p>No upcoming events found.</p>';
            return;
        }
        
        eventsContainer.innerHTML = '';
        events.forEach(event => {
            const eventEl = document.createElement('div');
            eventEl.className = 'event-item';
            
            const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            
            if (event.type === 'court') {
                eventEl.innerHTML = `
                    <h3>Open Play at ${event.location}</h3>
                    <p>Date: ${event.date.toLocaleDateString('en-US', dateOptions)}</p>
                    <p>Time: ${event.time}</p>
                    <p>Available spots: ${event.availableSpots}</p>
                    <button class="book-btn" data-type="court" data-id="${event.id}">Book Now</button>
                `;
            } else {
                eventEl.innerHTML = `
                    <h3>${event.name}</h3>
                    <p>Date: ${event.date.toLocaleDateString('en-US', dateOptions)}</p>
                    <p>Time: ${event.time}</p>
                    <p>Location: ${event.location}</p>
                    <p>Available spots: ${event.availableSpots}</p>
                    <button class="book-btn" data-type="class" data-id="${event.id}">Book Now</button>
                `;
            }
            
            eventsContainer.appendChild(eventEl);
        });
        
        // Add event listeners to book buttons
        document.querySelectorAll('.book-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const user = auth.currentUser;
                if (!user) {
                    alert('Please login to book.');
                    loginBtn.click();
                    return;
                }
                
                const type = this.getAttribute('data-type');
                const id = this.getAttribute('data-id');
                
                // Redirect to booking page with event info
                if (type === 'court') {
                    window.location.href = `calendar.html?court=${id}`;
                } else {
                    window.location.href = `classes.html?class=${id}`;
                }
            });
        });
        
    }).catch(error => {
        console.error("Error loading events:", error);
        eventsContainer.innerHTML = '<p>Error loading events. Please try again later.</p>';
    });
}

// Load user data
function loadUserData(userId) {
    // This function would load user-specific data like their bookings
    // Implementation depends on specific needs
}