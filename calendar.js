```javascript
// Calendar functionality
document.addEventListener('DOMContentLoaded', function() {
    // Calendar elements
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const currentMonthLabel = document.getElementById('currentMonth');
    const calendarContainer = document.getElementById('calendar-container');
    const bookingDetails = document.getElementById('booking-details');
    const selectedDate = document.getElementById('selected-date');
    const selectedTime = document.getElementById('selected-time');
    const selectedCourt = document.getElementById('selected-court');
    const confirmBookingBtn = document.getElementById('confirmBooking');

    // Current date
    let currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();

    // Available court times from Firestore
    let availableCourts = [];

    // Fetch available court times
    function fetchAvailableCourts() {
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
        
        db.collection('courts')
            .where('date', '>=', startOfMonth)
            .where('date', '<=', endOfMonth)
            .get()
            .then(snapshot => {
                availableCourts = [];
                snapshot.forEach(doc => {
                    const court = doc.data();
                    court.id = doc.id;
                    availableCourts.push(court);
                });
                renderCalendar();
            })
            .catch(error => {
                console.error("Error fetching courts:", error);
            });
    }

    // Render calendar
    function renderCalendar() {
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        
        currentMonthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        
        // Create calendar grid
        let firstDay = new Date(currentYear, currentMonth, 1).getDay();
        let daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Sun</th>
                        <th>Mon</th>
                        <th>Tue</th>
                        <th>Wed</th>
                        <th>Thu</th>
                        <th>Fri</th>
                        <th>Sat</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let day = 1;
        for (let i = 0; i < 6; i++) {
            html += '<tr>';
            
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDay) {
                    html += '<td></td>';
                } else if (day > daysInMonth) {
                    html += '<td></td>';
                } else {
                    // Check if there are available courts on this day
                    const currentDateCheck = new Date(currentYear, currentMonth, day);
                    const available = availableCourts.some(court => {
                        const courtDate = court.date.toDate();
                        return courtDate.getDate() === day && 
                               courtDate.getMonth() === currentMonth && 
                               courtDate.getFullYear() === currentYear;
                    });
                    
                    const today = new Date();
                    const isToday = day === today.getDate() && 
                                   currentMonth === today.getMonth() && 
                                   currentYear === today.getFullYear();
                    
                    const classes = ['calendar-day'];
                    if (available) classes.push('available-day');
                    if (isToday) classes.push('today');
                    
                    html += `<td class="${classes.join(' ')}" data-date="${currentYear}-${currentMonth + 1}-${day}">${day}</td>`;
                    day++;
                }
            }
            
            html += '</tr>';
            
            if (day > daysInMonth) {
                break;
            }
        }
        
        html += '</tbody></table>';
        
        calendarContainer.innerHTML = html;
        
        // Add click event to dates
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.addEventListener('click', function() {
                const dateStr = this.getAttribute('data-date');
                const [year, month, day] = dateStr.split('-').map(Number);
                
                // Get available times for this date
                const dateObj = new Date(year, month - 1, day);
                const courtsOnDate = availableCourts.filter(court => {
                    const courtDate = court.date.toDate();
                    return courtDate.getDate() === day && 
                           courtDate.getMonth() === month - 1 && 
                           courtDate.getFullYear() === year;
                });
                
                if (courtsOnDate.length > 0) {
                    showBookingTimes(dateObj, courtsOnDate);
                } else {
                    alert('No courts available on this date.');
                }
            });
        });
    }

    // Show available booking times for selected date
    function showBookingTimes(date, courtsOnDate) {
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        selectedDate.textContent = date.toLocaleDateString('en-US', dateOptions);
        
        // Create time selector
        let timeOptionsHtml = '<select id="timeSelect">';
        courtsOnDate.forEach(court => {
            timeOptionsHtml += `<option value="${court.id}">${court.time} at ${court.location} (${court.availableSpots} spots)</option>`;
        });
        timeOptionsHtml += '</select>';
        
        selectedTime.innerHTML = timeOptionsHtml;
        
        // Update court selection based on time
        document.getElementById('timeSelect').addEventListener('change', function() {
            const selectedCourtId = this.value;
            const court = courtsOnDate.find(c => c.id === selectedCourtId);
            selectedCourt.textContent = `${court.location} (${court.availableSpots} spots available)`;
        });
        
        // Trigger change event to set initial value
        document.getElementById('timeSelect').dispatchEvent(new Event('change'));
        
        bookingDetails.style.display = 'block';
    }

    // Handle booking confirmation
    confirmBookingBtn.addEventListener('click', function() {
        const user = auth.currentUser;
        if (!user) {
            alert('Please login to book a court.');
            return;
        }
        
        const timeSelect = document.getElementById('timeSelect');
        const selectedCourtId = timeSelect.value;
        
        // Add booking to Firestore
        db.collection('bookings').add({
            courtId: selectedCourtId,
            userId: user.uid,
            bookedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            // Update court availability
            const courtRef = db.collection('courts').doc(selectedCourtId);
            return db.runTransaction(transaction => {
                return transaction.get(courtRef).then(courtDoc => {
                    if (!courtDoc.exists) {
                        throw "Court does not exist!";
                    }
                    
                    const newAvailableSpots = courtDoc.data().availableSpots - 1;
                    if (newAvailableSpots < 0) {
                        throw "No spots available!";
                    }
                    
                    transaction.update(courtRef, { availableSpots: newAvailableSpots });
                });
            });
        })
        .then(() => {
            alert('Court booked successfully!');
            bookingDetails.style.display = 'none';
            fetchAvailableCourts(); // Refresh calendar
        })
        .catch(error => {
            console.error("Error booking court:", error);
            alert('Error booking court: ' + error);
        });
    });

    // Month navigation
    prevMonthBtn.addEventListener('click', function() {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        fetchAvailableCourts();
    });
    
    nextMonthBtn.addEventListener('click', function() {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        fetchAvailableCourts();
    });

    // Initial load
    fetchAvailableCourts();
});
```