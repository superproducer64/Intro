document.addEventListener('DOMContentLoaded', () => {
  const AUTH_KEY = 'intro_user_auth';
  const introScreen = document.getElementById('introScreen');
  const authScreen = document.getElementById('authScreen');
  const questionnaireScreen = document.getElementById('questionnaireScreen');
  const mainApp = document.getElementById('mainApp');
  
  // Questionnaire state
  let currentPage = 1;
  const totalPages = 8;
  const selectedInterests = new Set();
  
  // Check if user is already logged in
  const savedAuth = localStorage.getItem(AUTH_KEY);
  if (savedAuth) {
    introScreen.classList.add('hidden');
    authScreen.classList.remove('active');
    mainApp.style.display = 'flex';
    initMainApp();
  } else {
    // Show splash screen, then auth
    setTimeout(() => {
      introScreen.classList.add('fade-out');
      setTimeout(() => {
        introScreen.classList.add('hidden');
        authScreen.classList.add('active');
      }, 600);
    }, 2500);
  }

  // Auth tabs
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('loginForm');
  const signupPrompt = document.getElementById('signupPrompt');

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      if (tab.dataset.auth === 'login') {
        loginForm.classList.remove('hidden');
        signupPrompt.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        signupPrompt.classList.remove('hidden');
      }
    });
  });

  // Start signup questionnaire
  const startSignupBtn = document.getElementById('startSignupBtn');
  if (startSignupBtn) {
    startSignupBtn.addEventListener('click', () => {
      authScreen.classList.remove('active');
      questionnaireScreen.classList.add('active');
      currentPage = 1;
      updateProgress();
      showPage(1);
    });
  }

  // Login handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;
    const errorEl = document.getElementById('loginError');
    const btn = loginForm.querySelector('button');
    
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorEl.textContent = '';
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(data));
        authScreen.classList.remove('active');
        mainApp.style.display = 'flex';
        initMainApp();
      } else {
        errorEl.textContent = data.error || 'Login failed';
      }
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
    }
    
    btn.disabled = false;
    btn.textContent = 'Sign In';
  });

  // Questionnaire Functions
  function updateProgress() {
    const progress = (currentPage / totalPages) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
  }

  function showPage(pageNum) {
    document.querySelectorAll('.q-page').forEach(p => p.classList.remove('active'));
    const page = document.querySelector(`.q-page[data-page="${pageNum}"]`);
    if (page) page.classList.add('active');
    
    // Hide all errors
    document.querySelectorAll('.q-error').forEach(e => e.classList.remove('show'));
  }

  window.nextPage = function() {
    // Validate current page
    if (!validatePage(currentPage)) return;
    
    currentPage++;
    if (currentPage > totalPages) currentPage = totalPages;
    updateProgress();
    showPage(currentPage);
  };

  window.prevPage = function() {
    currentPage--;
    if (currentPage < 1) currentPage = 1;
    updateProgress();
    showPage(currentPage);
  };

  window.cancelQuestionnaire = function() {
    questionnaireScreen.classList.remove('active');
    authScreen.classList.add('active');
    // Reset to login tab
    authTabs[0].click();
  };

  function validatePage(page) {
    switch(page) {
      case 1:
        const profileType = document.querySelector('input[name="profileType"]:checked');
        if (!profileType) {
          document.getElementById('page1Error').classList.add('show');
          return false;
        }
        return true;
      case 2:
        const name = document.getElementById('qName').value.trim();
        const age = document.getElementById('qAge').value;
        const location = document.getElementById('qLocation').value.trim();
        const personality = document.querySelector('input[name="personality"]:checked');
        if (!name || !age || !location || !personality) {
          document.getElementById('page2Error').classList.add('show');
          return false;
        }
        if (parseInt(age) < 18 || parseInt(age) > 120) {
          document.getElementById('page2Error').textContent = 'Age must be between 18 and 120';
          document.getElementById('page2Error').classList.add('show');
          return false;
        }
        return true;
      case 3:
        // Photo is optional
        return true;
      case 4:
        const bio = document.getElementById('qBio').value.trim();
        const lookingFor = document.querySelector('input[name="lookingFor"]:checked');
        if (!bio || !lookingFor) {
          document.getElementById('page4Error').classList.add('show');
          return false;
        }
        return true;
      case 5:
        if (selectedInterests.size < 3) {
          document.getElementById('page5Error').classList.add('show');
          return false;
        }
        return true;
      case 6:
        const email = document.getElementById('qEmail').value.trim();
        const password = document.getElementById('qPassword').value;
        const passwordConfirm = document.getElementById('qPasswordConfirm').value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email || !emailRegex.test(email)) {
          document.getElementById('page6Error').textContent = 'Please enter a valid email address';
          document.getElementById('page6Error').classList.add('show');
          return false;
        }
        if (password.length < 6) {
          document.getElementById('page6Error').textContent = 'Password must be at least 6 characters';
          document.getElementById('page6Error').classList.add('show');
          return false;
        }
        if (password !== passwordConfirm) {
          document.getElementById('page6Error').textContent = 'Passwords do not match';
          document.getElementById('page6Error').classList.add('show');
          return false;
        }
        return true;
      case 7:
        const guidelines = document.getElementById('agreeGuidelines').checked;
        const privacy = document.getElementById('agreePrivacy').checked;
        if (!guidelines || !privacy) {
          document.getElementById('page7Error').classList.add('show');
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  window.toggleTag = function(el) {
    const interest = el.textContent.trim();
    if (el.classList.contains('selected')) {
      el.classList.remove('selected');
      selectedInterests.delete(interest);
    } else {
      el.classList.add('selected');
      selectedInterests.add(interest);
    }
    // Hide error if we have enough interests
    if (selectedInterests.size >= 3) {
      document.getElementById('page5Error').classList.remove('show');
    }
  };

  window.selectRadioOption = function(el, name) {
    // Remove selected from siblings
    el.parentElement.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input[type="radio"]').checked = true;
  };

  // Photo upload handling
  const photoInput = document.getElementById('photoInput');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          document.getElementById('photoPreview').src = e.target.result;
          document.getElementById('uploadZone').style.display = 'none';
          document.getElementById('previewContainer').style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Bio character count
  const bioTextarea = document.getElementById('qBio');
  if (bioTextarea) {
    bioTextarea.addEventListener('input', () => {
      const count = bioTextarea.value.length;
      const countEl = document.getElementById('charCount');
      countEl.textContent = count;
      if (count > 450) {
        countEl.parentElement.classList.add('warning');
      } else {
        countEl.parentElement.classList.remove('warning');
      }
    });
  }

  window.submitQuestionnaire = async function() {
    if (!validatePage(7)) return;
    
    const btn = document.getElementById('createProfileBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    
    // Gather all data
    const profileData = {
      name: document.getElementById('qName').value.trim(),
      age: parseInt(document.getElementById('qAge').value),
      email: document.getElementById('qEmail').value.trim(),
      password: document.getElementById('qPassword').value,
      bio: document.getElementById('qBio').value.trim(),
      location: document.getElementById('qLocation').value.trim(),
      profileType: document.querySelector('input[name="profileType"]:checked')?.value,
      personality: document.querySelector('input[name="personality"]:checked')?.value,
      lookingFor: document.querySelector('input[name="lookingFor"]:checked')?.value,
      interests: Array.from(selectedInterests)
    };
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Show success page
        currentPage = 8;
        updateProgress();
        showPage(8);
      } else {
        btn.disabled = false;
        btn.textContent = 'Create My Profile';
        document.getElementById('page7Error').textContent = data.error || 'Registration failed. Please try again.';
        document.getElementById('page7Error').classList.add('show');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Create My Profile';
      document.getElementById('page7Error').textContent = 'Connection error. Please try again.';
      document.getElementById('page7Error').classList.add('show');
    }
  };

  window.startApp = async function() {
    const btn = document.querySelector('.success-page .q-btn-primary');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Starting...';
    }
    
    const email = document.getElementById('qEmail').value.trim();
    const password = document.getElementById('qPassword').value;
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(data));
        questionnaireScreen.classList.remove('active');
        mainApp.style.display = 'flex';
        initMainApp();
      } else {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Start Connecting';
        }
        showStartError('Unable to sign in. Please try again or go to login.');
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Start Connecting';
      }
      showStartError('Connection error. Please check your internet and try again.');
    }
  };
  
  function showStartError(message) {
    let errorEl = document.querySelector('.success-page .start-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.className = 'start-error';
      errorEl.style.cssText = 'color: #ef4444; font-size: 14px; margin-top: 12px; text-align: center;';
      const successPage = document.querySelector('.success-page');
      if (successPage) successPage.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  function initMainApp() {
    const currentCard = document.getElementById('currentCard');
    const passBtn = document.getElementById('passBtn');
    const likeBtn = document.getElementById('likeBtn');
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    function showErrorMessage(message) {
      let errorEl = document.getElementById('errorToast');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'errorToast';
        errorEl.className = 'error-toast';
        document.body.appendChild(errorEl);
      }
      errorEl.textContent = message;
      errorEl.classList.add('show');
      setTimeout(() => {
        errorEl.classList.remove('show');
      }, 5000);
    }

    let profiles = [];
    let currentIndex = 0;

    async function loadProfiles() {
      try {
        const res = await fetch('/api/profiles');
        if (res.ok) {
          profiles = await res.json();
          if (profiles.length > 0) updateCard();
        }
      } catch (e) {
        console.error('Failed to load profiles');
      }
    }

    loadProfiles();

  function updateCard() {
    if (profiles.length === 0) return;
    if (currentIndex >= profiles.length) {
      currentIndex = 0;
    }
    const profile = profiles[currentIndex];
    const nameEl = currentCard.querySelector('.profile-name');
    const bioEl = currentCard.querySelector('.profile-bio');
    nameEl.textContent = profile.name;
    bioEl.textContent = profile.bio;
    currentCard.classList.remove('swiping-left', 'swiping-right');
  }

  function swipe(direction) {
    currentCard.classList.add(direction === 'left' ? 'swiping-left' : 'swiping-right');
    setTimeout(() => {
      currentIndex++;
      updateCard();
    }, 300);
  }

  function switchTab(tabName) {
    // Hide all tabs
    tabContents.forEach(tab => tab.classList.remove('active'));
    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
      selectedTab.classList.add('active');
    }

    // Update nav items
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.tab === tabName) {
        item.classList.add('active');
      }
    });
  }

  passBtn.addEventListener('click', () => swipe('left'));
  likeBtn.addEventListener('click', () => swipe('right'));

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab;
      switchTab(tabName);
    });
  });

  updateCard();

  // Experience Modal Functionality
  const experienceCards = document.querySelectorAll('.experience-card');
  const modal = document.getElementById('experienceModal');
  const modalBody = document.getElementById('modalBody');
  const closeModal = document.getElementById('closeModal');

  const experienceData = {
    cafe: {
      icon: '☕',
      title: 'Virtual Cafe',
      description: 'A cozy space to have meaningful conversations over virtual coffee.',
      preview: `
        <div class="preview-section">
          <div class="preview-label">Example Chat</div>
          <div class="preview-chat">
            <div class="chat-bubble received">Hi! What's your go-to coffee order?</div>
            <div class="chat-bubble sent">Definitely a vanilla oat latte. You?</div>
            <div class="chat-bubble received">Classic cappuccino for me! Have you tried the new cafe downtown?</div>
          </div>
        </div>
      `
    },
    movie: {
      icon: '🎬',
      title: 'Movie Night',
      description: 'Watch films together in sync and chat about your favorite scenes.',
      preview: `
        <div class="preview-section">
          <div class="preview-label">Now Watching</div>
          <div class="preview-content">
            <strong>The Grand Budapest Hotel</strong><br>
            <span style="color: var(--text-secondary);">Comedy • 1h 39m</span>
          </div>
        </div>
        <div class="preview-section">
          <div class="preview-label">Live Chat</div>
          <div class="preview-chat">
            <div class="chat-bubble received">This cinematography is stunning!</div>
            <div class="chat-bubble sent">Right? Wes Anderson is a genius</div>
          </div>
        </div>
      `,
      hasLaunch: true
    },
    gaming: {
      icon: '🎮',
      title: 'Gaming Together',
      description: 'Play casual co-op games and bond over shared victories.',
      preview: `
        <div class="preview-section">
          <div class="preview-label">Popular 2-Player Games</div>
          <div class="preview-content">
            <div style="margin-bottom: 8px;">🎱 8 Ball Pool</div>
            <div style="margin-bottom: 8px;">♟️ Chess</div>
            <div style="margin-bottom: 8px;">🏀 Basket Random</div>
            <div>🔫 Rooftop Snipers</div>
          </div>
        </div>
      `,
      hasLaunch: true,
      launchUrl: 'https://www.crazygames.com/t/2-player',
      launchText: 'Start Gaming Session'
    },
    book: {
      icon: '📚',
      title: 'Book Club',
      description: 'Discuss your favorite reads with fellow book lovers.',
      preview: `
        <div class="preview-section">
          <div class="preview-label">This Month's Pick</div>
          <div class="preview-content">
            <strong>The Midnight Library</strong><br>
            <span style="color: var(--text-secondary);">by Matt Haig</span>
          </div>
        </div>
        <div class="preview-section">
          <div class="preview-label">Discussion Topics</div>
          <div class="preview-chat">
            <div class="chat-bubble received">What would your "perfect life" look like?</div>
            <div class="chat-bubble sent">I think the message is that there's no perfect life...</div>
          </div>
        </div>
      `
    }
  };

  experienceCards.forEach(card => {
    card.addEventListener('click', () => {
      const experience = card.dataset.experience;
      const data = experienceData[experience];
      
      const launchButtonText = data.launchText || 'Launch Watch Party';
      const launchUrl = data.launchUrl || 'https://www.youtube.com';
      const launchButton = data.hasLaunch ? `
        <button class="launch-btn" id="launchExperience" data-url="${launchUrl}">${launchButtonText}</button>
        <div class="hyperbeam-container" id="hyperbeamContainer" style="display: none;">
          <iframe id="hyperbeamFrame" allow="autoplay; fullscreen" allowfullscreen></iframe>
        </div>
      ` : '';
      
      modalBody.innerHTML = `
        <div class="modal-icon">${data.icon}</div>
        <h2 class="modal-title">${data.title}</h2>
        <p class="modal-description">${data.description}</p>
        ${data.preview}
        ${launchButton}
        <p class="notify-label">Notify Me When Available</p>
        <form class="signup-form" id="signupForm">
          <input type="text" name="name" placeholder="Your Name" required>
          <input type="email" name="email" placeholder="Your Email" required>
          <button type="submit" class="notify-btn">Sign Up</button>
        </form>
        <p class="signup-success" id="signupSuccess" style="display: none;">Thanks! We'll notify you when this is available.</p>
      `;
      
      modal.classList.add('active');
      
      const signupForm = document.getElementById('signupForm');
      const signupSuccess = document.getElementById('signupSuccess');
      
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(signupForm);
        const submitBtn = signupForm.querySelector('button');
        submitBtn.textContent = 'Signing up...';
        submitBtn.disabled = true;
        
        try {
          const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.get('name'),
              email: formData.get('email'),
              experience: experience
            })
          });
          
          if (response.ok) {
            signupForm.style.display = 'none';
            signupSuccess.style.display = 'block';
          } else {
            submitBtn.textContent = 'Sign Up';
            submitBtn.disabled = false;
            alert('Signup failed. Please try again.');
          }
        } catch (error) {
          submitBtn.textContent = 'Sign Up';
          submitBtn.disabled = false;
          alert('Signup failed. Please try again.');
        }
      });
      
      const launchBtn = document.getElementById('launchExperience');
      if (launchBtn) {
        const originalText = launchBtn.textContent;
        launchBtn.addEventListener('click', async () => {
          launchBtn.textContent = 'Starting...';
          launchBtn.disabled = true;
          const targetUrl = launchBtn.dataset.url || 'https://www.youtube.com';
          
          try {
            const response = await fetch('/api/hyperbeam/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: targetUrl })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              const container = document.getElementById('hyperbeamContainer');
              const iframe = document.getElementById('hyperbeamFrame');
              iframe.src = data.embed_url;
              container.style.display = 'block';
              launchBtn.style.display = 'none';
            } else {
              launchBtn.textContent = originalText;
              launchBtn.disabled = false;
              
              let errorMsg = 'Unable to start session. ';
              if (data.error && data.error.includes('VM limit')) {
                errorMsg += 'Too many active sessions. Please wait a few minutes and try again, or close other watch parties first.';
              } else if (data.error && data.error.includes('API key')) {
                errorMsg += 'Service configuration issue. Please contact support.';
              } else if (data.error && data.error.includes('rate')) {
                errorMsg += 'Too many requests. Please wait a moment and try again.';
              } else {
                errorMsg += data.error || 'Please try again later.';
              }
              
              showErrorMessage(errorMsg);
            }
          } catch (error) {
            launchBtn.textContent = originalText;
            launchBtn.disabled = false;
            showErrorMessage('Connection error. Please check your internet and try again.');
          }
        });
      }
    });
  });

    closeModal.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
    
    // Load current user's profile data
    function loadUserProfile() {
      const authData = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      const user = authData.user || {};
      
      const initialsEl = document.getElementById('profileInitials');
      const nameEl = document.getElementById('profileName');
      const ageEl = document.getElementById('profileAge');
      const bioEl = document.getElementById('profileBio');
      
      if (user.name) {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        if (initialsEl) initialsEl.textContent = initials;
        if (nameEl) nameEl.value = user.name;
      }
      if (user.age && ageEl) ageEl.value = user.age;
      if (user.bio && bioEl) bioEl.value = user.bio;
    }
    
    loadUserProfile();
    
    // Default to discover tab to show potential matches
    switchTab('discover');
  } // End initMainApp
});
