<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Intro — Dating at your own pace</title>
<meta name="description" content="Intro is for people who'd rather be understood than noticed. No swipe deck, no match percentages. Tell your story one conversation at a time.">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Intro">
<meta property="og:title" content="Intro — Dating at your own pace">
<meta property="og:description" content="No swipe deck. No cold DMs. Tell your story the way you'd tell a friend, one conversation at a time.">
<meta property="og:url" content="https://intro.bgpstudios.com">
<meta property="og:image" content="https://intro.bgpstudios.com/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">

<script>document.documentElement.classList.add('js');</script>
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

  <div class="wrap">
    <header>
      <div class="wordmark">Intro</div>
    </header>

    <section class="hero">
      <div class="hero-text">
      <h1 class="reveal">You don't have to<br><em>perform</em> to be seen.</h1>
      <p class="reveal">Built for people who'd rather be understood than noticed. Tell your story
        the way you'd tell a friend, one conversation at a time.</p>
      <a href="#waitlist" class="hero-link reveal">Join the waitlist</a>
      </div>
      <div class="hero-art reveal">
        <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/koala-hero.png"
             alt="A hand-drawn koala peeking out from behind a tree." width="726" height="1142">
      </div>
    </section>
  </div>

  <hr class="rule">

  <div class="wrap">
    <section class="beats beats-do">
      <div class="beats-eyebrow reveal">What we do</div>

      <div class="beat reveal">
        <h3>Your profile writes itself, slowly.</h3>
        <p>No forms to fill out before anyone will see you. Intro's AI guide asks
          real questions, listens, and helps tell your story the way you'd tell it to a friend.</p>
      </div>

      <figure class="preview reveal">
        <div class="preview-row">
          <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/intro-ai-01-first-conversation.png"
               alt="Intro's AI guide asks about your favorite kind of Saturday and follows up on your answer." loading="lazy" width="460" height="860">
          <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/intro-ai-02-your-story.png"
               alt="The guide reflects your story back, with buttons for 'Sounds like me' and 'That doesn't sound like me.'" loading="lazy" width="460" height="860">
          <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/intro-ai-03-stop-for-today.png"
               alt="The guide ends the session: 'Let's stop here for today,' with the next conversation set for tomorrow." loading="lazy" width="460" height="860">
        </div>
        <figcaption>A preview of your first conversation.</figcaption>
      </figure>
    </section>

    <section class="beats beats-dont">
      <div class="beats-eyebrow reveal">What we don't do</div>

      <div class="beat reveal">
        <h3>No swipe deck.</h3>
        <p>You're not sorted like a hand of cards. Discover is a list — you look,
          you read, you decide, like a person would.</p>
      </div>

      <div class="beat reveal">
        <h3>No cold DMs.</h3>
        <p>Café rooms let you meet in a low-pressure group hangout before you're
          ever alone in a chat with a stranger.</p>
      </div>

      <div class="beat reveal">
        <h3>No match percentages.</h3>
        <p>"94% compatible" sounds scientific and means nothing. We just think
          you'll enjoy talking to each other — and let the conversation prove it.</p>
      </div>
    </section>
  </div>

  <section class="dusk">
    <div class="wrap">
      <blockquote class="reveal">
        "You can't be happy with someone else if you're not happy with yourself.
        Intro isn't about more matches — it's about better ones."
        <cite>— The Intro Team</cite>
      </blockquote>
    </div>
  </section>

  <div class="wrap">
    <section class="waitlist" id="waitlist">
      <div class="waitlist-label reveal">Before we tell you when</div>

      <div class="convo reveal">
        <div class="convo-prompt">
          <span class="convo-tag">IN:</span>
          <h2>What's one thing people misunderstand about you?</h2>
        </div>

        <div class="convo-reply">
          <form id="waitlist-form">
            <input type="text" class="field-answer" id="answer" placeholder="Type your answer…" maxlength="180">
            <div class="email-row">
              <input type="email" class="field-email" id="email" placeholder="you@email.com" required>
              <button type="submit" class="submit-btn">Notify me at launch</button>
            </div>
          </form>
          <p class="waitlist-note" id="waitlist-note">No spam, no countdown, no pressure. Just one email when we open the door.</p>
          <p class="success-msg" id="success-msg">Got it. We'll be in touch when it's time — no rush.</p>
        </div>
      </div>
    </section>
  </div>

  <div class="wrap">
    <footer>
      <div class="studio">A BGP STUDIOS PROJECT<span class="cursor"></span></div>
      <div class="studio">© 2026 INTRO</div>
    </footer>
  </div>

  <script>
    const revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting){
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.15 });
      revealEls.forEach(el => io.observe(el));
    }
    // Safety net: anything still hidden after 2.5s gets shown anyway.
    setTimeout(() => revealEls.forEach(el => el.classList.add('in')), 2500);

    const SUPABASE_URL = 'https://mryeofmyqibadeiostsg.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_6HoN1p7hnp6AauKsvhfz3A_1xzI9I9Z';

    const form = document.getElementById('waitlist-form');
    const note = document.getElementById('waitlist-note');
    const success = document.getElementById('success-msg');
    const submitBtn = form.querySelector('.submit-btn');

    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const email = document.getElementById('email').value.trim().toLowerCase();
      const answer = document.getElementById('answer').value.trim();
      if (!email) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      try{
        const res = await fetch(`${SUPABASE_URL}/rest/v1/signups`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            email: email,
            experience: answer || null
          })
        });

        // 409 = this email is already on the list. Treat it as a success.
        if (!res.ok && res.status !== 409){
          throw new Error(`Supabase insert failed: ${res.status}`);
        }

        form.style.display = 'none';
        note.style.display = 'none';
        success.classList.add('show');
      }catch(err){
        console.error(err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Notify me at launch';
        note.textContent = "That didn't go through. Check your connection and try again.";
      }
    });
  </script>

  <?php wp_footer(); ?>
</body>
</html>
