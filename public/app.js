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
});
