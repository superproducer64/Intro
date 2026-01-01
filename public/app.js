document.addEventListener('DOMContentLoaded', () => {
  const currentCard = document.getElementById('currentCard');
  const passBtn = document.getElementById('passBtn');
  const likeBtn = document.getElementById('likeBtn');
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  const profiles = [
    {
      name: 'Emma, 28',
      bio: 'Bookworm and coffee enthusiast. Looking for someone to share quiet evenings and deep conversations.'
    },
    {
      name: 'Sophia, 25',
      bio: 'Gamer and nature lover. Introvert who enjoys long walks and cozy nights in.'
    },
    {
      name: 'Olivia, 30',
      bio: 'Artist and homebody. Love creating art, watching documentaries, and cooking new recipes.'
    },
    {
      name: 'Isabella, 27',
      bio: 'Music lover and aspiring writer. Seeking genuine connection over loud parties.'
    },
    {
      name: 'Mia, 29',
      bio: 'Tech enthusiast and plant parent. Prefer board games nights to club scenes.'
    }
  ];

  let currentIndex = 0;

  function updateCard() {
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
      `
    },
    gaming: {
      icon: '🎮',
      title: 'Gaming Together',
      description: 'Play casual co-op games and bond over shared victories.',
      preview: `
        <div class="preview-section">
          <div class="preview-label">Available Games</div>
          <div class="preview-content">
            <div style="margin-bottom: 8px;">🧩 Puzzle Quest Co-op</div>
            <div style="margin-bottom: 8px;">🃏 Card Game Arena</div>
            <div style="margin-bottom: 8px;">🎯 Trivia Challenge</div>
            <div>🌍 Word Adventures</div>
          </div>
        </div>
      `
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
      
      modalBody.innerHTML = `
        <div class="modal-icon">${data.icon}</div>
        <h2 class="modal-title">${data.title}</h2>
        <p class="modal-description">${data.description}</p>
        ${data.preview}
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
});
