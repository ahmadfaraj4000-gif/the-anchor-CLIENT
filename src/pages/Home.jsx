import { useEffect, useMemo, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { PortalNav } from "../components/PortalNav";
import { SignupForm } from "../components/SignupForm";
import { useLocalClient } from "../hooks/useLocalClient";
import { interests } from "../lib/portalData";

const tabs = [
  ["feed", "News Feed"],
  ["calendar", "Calendar"],
  ["profile", "Profile"],
  ["volunteer", "Volunteer Now"],
  ["gym", "Find a Gym Partner"],
  ["friends", "My Friends"]
];

const dayOptions = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timeOptions = ["Early Morning", "Morning", "Lunch", "Afternoon", "After Work", "Evening", "Weekend Flexible"];
const goalOptions = ["Strength", "Weight Loss", "Consistency", "Cardio", "Boxing", "Mobility", "General Fitness"];

const emptyGymForm = {
  preferredGym: "",
  days: [],
  times: [],
  fitnessLevel: "Getting Started",
  goals: [],
  partnerPreference: "",
  transportation: "",
  notes: "",
  active: true
};

function AuthGate({ status, apiPost }) {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState("signIn");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    if (step === "signUp") {
      const email = form.email.value.trim().toLowerCase();
      try {
        const { exists } = await apiPost("/api/account-exists", { email });
        if (exists) {
          localStorage.removeItem("anchorPendingProfile");
          setStep("signIn");
          setError("That email already has an account. Sign in with that email instead.");
          return;
        }
      } catch {
        setError("Could not check that email. Try again in a moment.");
        return;
      }
      localStorage.setItem("anchorPendingProfile", JSON.stringify({
        name: form.name.value.trim(),
        email,
        phone: form.phone.value.trim(),
        dateOfBirth: form.dateOfBirth.value,
        interests: form.interests.value,
        neighborhood: form.neighborhood.value.trim(),
        familyRole: form.familyRole.value,
        preferredContact: form.preferredContact.value,
        supportNeeds: form.supportNeeds.value.trim()
      }));
    }
    try {
      await signIn("password", formData);
    } catch (authError) {
      if (step === "signUp") localStorage.removeItem("anchorPendingProfile");
      const message = authError instanceof Error ? authError.message : "";
      setError(step === "signUp"
        ? "Account creation failed. If this email already has an account, switch to Sign In."
        : message || "Authentication failed. Check your email and password.");
    }
  }

  return (
    <>
      <PortalNav />
      <section className="authGate">
        <div className="authGatePanel">
          <div className="authGateIntro">
            <p className="eyebrow">Member Portal</p>
            <h1>{step === "signIn" ? "Sign in to continue." : "Create your Anchor profile."}</h1>
            <p>{step === "signIn" ? "Use your email and password to open your dashboard, news feed, events, gym partner tools, and messages." : "Your account and member profile are created together, then your dashboard opens right away."}</p>
          </div>
          <form className="authGateForm" onSubmit={submit}>
            <input name="flow" type="hidden" value={step} />
            {step === "signUp" ? (
              <>
                <label>Full Name</label>
                <input name="name" required />
              </>
            ) : null}
            <label>Email</label>
            <input name="email" type="email" required />
            <label>Password</label>
            <input name="password" type="password" required />
            {step === "signUp" ? (
              <>
                <label>Phone</label>
                <input name="phone" />
                <label>Date of Birth</label>
                <input name="dateOfBirth" type="date" required />
                <label>Hartford Neighborhood</label>
                <input name="neighborhood" placeholder="North End, South End, Asylum Hill..." />
                <label>Family Role</label>
                <select name="familyRole">
                  <option>Father</option>
                  <option>Mother</option>
                  <option>Guardian</option>
                  <option>Mentor</option>
                  <option>Caregiver</option>
                  <option>Community Member</option>
                </select>
                <label>Main Interest</label>
                <select name="interests">{interests.map((interest) => <option key={interest}>{interest}</option>)}</select>
                <label>Preferred Contact</label>
                <select name="preferredContact"><option>Email</option><option>Phone</option><option>Text</option></select>
                <label>Support Needs</label>
                <textarea name="supportNeeds" rows="3" placeholder="Anything helpful for the team to know" />
              </>
            ) : null}
            <button className="btn green">{step === "signIn" ? "Sign In" : "Create Account"}</button>
            <button className="textButton" type="button" onClick={() => setStep(step === "signIn" ? "signUp" : "signIn")}>
              {step === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
            {error ? <p className="notice">{error}</p> : null}
            {status ? <p className="notice">{status}</p> : null}
          </form>
        </div>
      </section>
    </>
  );
}

function formatDate(event) {
  if (event.dateLabel && event.timeLabel) return `${event.dateLabel} at ${event.timeLabel}`;
  return new Date(event.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function podcastOptions(podcast) {
  return [
    ["YouTube", podcast.youtubeEmbedUrl || (podcast.platform === "YouTube" ? podcast.embedUrl : "")],
    ["Spotify", podcast.spotifyEmbedUrl || (podcast.platform === "Spotify" ? podcast.embedUrl : "")],
    ["Apple Music", podcast.appleMusicEmbedUrl || (podcast.platform === "Apple Music" ? podcast.embedUrl : "")]
  ].filter(([, url]) => url);
}

export function Home() {
  const { signOut } = useAuthActions();
  const { client, registerClient, status, setStatus, apiGet, apiPost, isSignedIn, isAuthLoading } = useLocalClient();
  const [activeTab, setActiveTab] = useState("feed");
  const [data, setData] = useState({ events: [], podcasts: [], resources: [], causes: [] });
  const [volunteerForm, setVolunteerForm] = useState({ role: "Event Support", availability: "" });
  const [volunteeredEventIds, setVolunteeredEventIds] = useState(() => new Set());
  const [gymData, setGymData] = useState({ profile: null, matches: [], requests: [], messages: [] });
  const [gymForm, setGymForm] = useState(emptyGymForm);
  const [gymMessage, setGymMessage] = useState("");
  const [messageDrafts, setMessageDrafts] = useState({});
  const [reportDraft, setReportDraft] = useState({ reason: "Safety concern", details: "" });

  useEffect(() => {
    let mounted = true;
    apiGet("/api/public")
      .then((payload) => {
        if (mounted) setData({
          events: payload.events || [],
          podcasts: payload.podcasts || [],
          resources: payload.resources || [],
          causes: payload.causes || []
        });
      })
      .catch((error) => setStatus(error.message));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!client?.email) return;
    loadGymData();
  }, [client?.email]);

  useEffect(() => {
    if (!status || /login required/i.test(status)) return undefined;
    const timeout = window.setTimeout(() => setStatus(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [status, setStatus]);

  useEffect(() => {
    if (isSignedIn && /login required/i.test(status)) setStatus("");
  }, [isSignedIn, status, setStatus]);

  const posts = useMemo(() => {
    const eventPosts = data.events.map((event) => ({
      id: event._id,
      type: "events",
      label: "Event",
      title: event.title,
      body: event.description,
      imageUrl: event.imageUrl,
      sortAt: event.startsAt || event._creationTime || 0,
      item: event
    }));
    const podcastPosts = data.podcasts.map((podcast) => ({
      id: podcast._id,
      type: "podcasts",
      label: "Podcast",
      title: podcast.title,
      body: podcast.description,
      imageUrl: podcast.imageUrl,
      sortAt: podcast.publishedAt || podcast._creationTime || 0,
      item: podcast
    }));
    const resourcePosts = data.resources.map((resource) => ({
      id: resource._id,
      type: "resources",
      label: "Resource",
      title: resource.name,
      body: resource.description,
      sortAt: resource.createdAt || resource._creationTime || 0,
      item: resource
    }));
    const causePosts = data.causes.map((cause) => ({
      id: cause._id,
      type: "causes",
      label: "Donation Cause",
      title: cause.title,
      body: cause.description,
      sortAt: cause.createdAt || cause._creationTime || 0,
      item: cause
    }));
    return [...eventPosts, ...podcastPosts, ...resourcePosts, ...causePosts].sort((a, b) => b.sortAt - a.sortAt);
  }, [data]);

  const upcomingEvents = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return [...data.events]
      .filter((event) => (event.startsAt || 0) >= startOfToday.getTime())
      .sort((a, b) => (a.startsAt || 0) - (b.startsAt || 0));
  }, [data.events]);

  const calendarGroups = useMemo(() => {
    return upcomingEvents.reduce((groups, event) => {
      const month = new Date(event.startsAt).toLocaleString([], { month: "long", year: "numeric" });
      groups[month] = [...(groups[month] || []), event];
      return groups;
    }, {});
  }, [upcomingEvents]);

  async function rsvp(eventId) {
    if (!client?.email) {
      setActiveTab("profile");
      setStatus("Create a member profile or log in before you RSVP.");
      return;
    }
    try {
      await apiPost("/api/rsvp", { eventId });
      setData((current) => ({
        ...current,
        events: current.events.map((event) => event._id === eventId ? { ...event, rsvpCount: (event.rsvpCount || 0) + 1 } : event)
      }));
      setStatus("You're RSVP'd. We'll see you there.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "RSVP failed. Sign out and sign back in.");
    }
  }

  async function volunteer(eventId) {
    if (!client?.email) {
      setActiveTab("profile");
      setStatus("Create a member profile or log in before you volunteer.");
      return;
    }
    try {
      const result = await apiPost("/api/volunteer", {
        eventId,
        role: volunteerForm.role,
        availability: volunteerForm.availability
      });
      setVolunteeredEventIds((current) => new Set([...current, eventId]));
      if (result.created) {
        setData((current) => ({
          ...current,
          events: current.events.map((event) => event._id === eventId ? { ...event, volunteerCount: (event.volunteerCount || 0) + 1 } : event)
        }));
        setStatus("You're on the volunteer list for that event.");
      } else {
        setStatus("You're already on that volunteer list.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Volunteer signup failed. Sign out and sign back in.");
    }
  }

  async function loadGymData() {
    if (!client?.email) return;
    try {
      const payload = await apiGet(`/api/gym-partners?email=${encodeURIComponent(client.email)}`);
      setGymData({
        profile: payload.profile || null,
        matches: payload.matches || [],
        requests: payload.requests || [],
        messages: payload.messages || []
      });
      if (payload.profile) {
        setGymForm({
          preferredGym: payload.profile.preferredGym || "",
          days: payload.profile.days || [],
          times: payload.profile.times || [],
          fitnessLevel: payload.profile.fitnessLevel || "Getting Started",
          goals: payload.profile.goals || [],
          partnerPreference: payload.profile.partnerPreference || "",
          transportation: payload.profile.transportation || "",
          notes: payload.profile.notes || "",
          active: payload.profile.active ?? true
        });
      }
    } catch (error) {
      setStatus(error.message);
    }
  }

  function toggleGymList(field, value) {
    setGymForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value]
    }));
  }

  async function saveGymProfile(event) {
    event.preventDefault();
    if (!client?.email) {
      setActiveTab("profile");
      setStatus("Create a member profile before you look for a gym partner.");
      return;
    }
    await apiPost("/api/gym-partners/profile", {
      ...gymForm,
      email: client.email
    });
    setStatus("Gym partner profile saved.");
    await loadGymData();
  }

  async function requestGymPartner(profileId) {
    if (!client?.email) {
      setActiveTab("profile");
      setStatus("Create a member profile before you request a gym partner.");
      return;
    }
    await apiPost("/api/gym-partners/request", {
      email: client.email,
      recipientProfileId: profileId,
      message: gymMessage
    });
    setGymMessage("");
    setStatus("Gym partner request sent.");
    await loadGymData();
  }

  async function respondGymRequest(requestId, status) {
    await apiPost("/api/gym-partners/respond", {
      email: client.email,
      requestId,
      status
    });
    setStatus(status === "accepted" ? "Connection accepted. Contact info is now visible." : "Request declined.");
    await loadGymData();
  }

  async function sendGymMessage(requestId) {
    const body = (messageDrafts[requestId] || "").trim();
    if (!body) return;
    await apiPost("/api/gym-partners/message", { requestId, body });
    setMessageDrafts((current) => ({ ...current, [requestId]: "" }));
    setStatus("Message sent.");
    await loadGymData();
  }

  async function blockGymUser(blockedEmail) {
    await apiPost("/api/gym-partners/block", { blockedEmail, reason: reportDraft.details });
    setStatus("User blocked. They will no longer appear in matches or messages.");
    await loadGymData();
  }

  async function reportGymIssue(payload) {
    await apiPost("/api/gym-partners/report", {
      ...payload,
      reason: reportDraft.reason,
      details: reportDraft.details
    });
    setReportDraft({ reason: "Safety concern", details: "" });
    setStatus("Safety report sent to the admin team.");
    await loadGymData();
  }

  if (isAuthLoading) {
    return (
      <>
        <PortalNav />
        <section className="authGate">
          <div className="authGatePanel">
            <div className="authGateIntro">
              <p className="eyebrow">Member Portal</p>
              <h1>Loading your secure session.</h1>
              <p>Hang tight while Convex Auth finishes signing you in.</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!isSignedIn) {
    return <AuthGate status={status} apiPost={apiPost} />;
  }

  function tabContent() {
    if (activeTab === "feed") {
      return (
        <>
          <div className="feedComposer">
            <div>
              <h1>News Feed</h1>
              <p className="lead">Events, podcast drops, resources, and causes from The Anchor Collective.</p>
            </div>
            <span>{posts.length} post{posts.length === 1 ? "" : "s"}</span>
          </div>
          <div className="feedList">
            {posts.map((post) => (
              <article className="feedPost" key={`${post.type}-${post.id}`}>
                <div className="feedPostHead">
                  <div>
                    <p className="eyebrow">{post.label}</p>
                    <h2>{post.title}</h2>
                  </div>
                  <span>{new Date(post.sortAt).toLocaleDateString()}</span>
                </div>

                {post.imageUrl && post.type !== "podcasts" ? <img className="feedImage" src={post.imageUrl} alt={post.title} /> : null}

                {post.type === "events" ? (
                  <>
                    <div className="feedFacts">
                      <span>{formatDate(post.item)}</span>
                      <span>{post.item.location}</span>
                      <span>{post.item.rsvpCount || 0} RSVP{(post.item.rsvpCount || 0) === 1 ? "" : "s"}</span>
                      <span>{post.item.volunteerCount || 0} volunteer{(post.item.volunteerCount || 0) === 1 ? "" : "s"}</span>
                    </div>
                    <p>{post.body}</p>
                    <button className="btn green" onClick={() => rsvp(post.id)}>RSVP</button>
                  </>
                ) : null}

                {post.type === "podcasts" ? (
                  <div className="podcastFeedAttachment">
                    <img src={post.imageUrl || "../assets/logos/logo.png"} alt={post.title} />
                    <div>
                      <p>{post.body}</p>
                      <div className="podcastFeedLinks">
                        {podcastOptions(post.item).map(([label, url]) => (
                          <a className="btn green" href={url} target="_blank" rel="noreferrer" key={label}>{label}</a>
                        ))}
                        {!podcastOptions(post.item).length ? <button className="btn" disabled>Links Coming Soon</button> : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {post.type === "resources" ? (
                  <>
                    <div className="feedFacts">
                      <span>{post.item.organizationType}</span>
                      <span>{post.item.specialty}</span>
                    </div>
                    <p>{post.body}</p>
                    <div className="resourceContact">
                      {post.item.contactName ? <span>{post.item.contactName}</span> : null}
                      {post.item.contactEmail ? <a href={`mailto:${post.item.contactEmail}`}>{post.item.contactEmail}</a> : null}
                      {post.item.contactPhone ? <a href={`tel:${post.item.contactPhone}`}>{post.item.contactPhone}</a> : null}
                      {post.item.website ? <a href={post.item.website} target="_blank" rel="noreferrer">Visit Website</a> : null}
                      {post.item.address ? <span>{post.item.address}</span> : null}
                    </div>
                  </>
                ) : null}

                {post.type === "causes" ? (
                  <>
                    <div className="feedFacts">
                      <span>Goal: ${Math.round((post.item.goalCents || 0) / 100).toLocaleString()}</span>
                    </div>
                    <p>{post.body}</p>
                    {post.item.paymentUrl ? <a className="btn green" href={post.item.paymentUrl} target="_blank" rel="noreferrer">Donate Now</a> : <button className="btn" disabled>Donation Link Coming Soon</button>}
                  </>
                ) : null}
              </article>
            ))}
            {!posts.length ? <p className="notice">Nothing is posted here yet.</p> : null}
          </div>
        </>
      );
    }

    if (activeTab === "calendar") {
      return (
        <section className="memberToolPanel wideToolPanel">
          <div className="feedPostHead">
            <div>
              <p className="eyebrow">Calendar</p>
              <h1>Upcoming events</h1>
            </div>
            <span>{upcomingEvents.length} upcoming</span>
          </div>
          <div className="calendarView">
            {Object.entries(calendarGroups).map(([month, events]) => (
              <section className="calendarMonth" key={month}>
                <h2>{month}</h2>
                <div className="calendarEventList">
                  {events.map((event) => (
                    <article className="calendarEvent" key={event._id}>
                      <div className="calendarDate">
                        <b>{new Date(event.startsAt).toLocaleString([], { day: "2-digit" })}</b>
                        <span>{new Date(event.startsAt).toLocaleString([], { weekday: "short" })}</span>
                      </div>
                      <div>
                        <p className="eyebrow">{event.category}</p>
                        <h3>{event.title}</h3>
                        <div className="feedFacts">
                          <span>{formatDate(event)}</span>
                          <span>{event.location}</span>
                        </div>
                        <p>{event.description}</p>
                        <div className="miniActions">
                          <button className="btn green" onClick={() => rsvp(event._id)}>RSVP</button>
                          <button className="btn" disabled={volunteeredEventIds.has(event._id)} onClick={() => volunteer(event._id)}>
                            {volunteeredEventIds.has(event._id) ? "Volunteer List Joined" : "Volunteer"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            {!upcomingEvents.length ? <p className="notice">No upcoming events are posted yet.</p> : null}
          </div>
        </section>
      );
    }

    if (activeTab === "volunteer") {
      return (
        <section className="memberToolPanel wideToolPanel">
          <p className="eyebrow">Volunteer Now</p>
          <h1>Volunteer for an event</h1>
          <p>Pick the event you want to help with. The team will see your name under that event.</p>
          <div className="volunteerControls">
            <div>
              <label>How would you like to help?</label>
              <select value={volunteerForm.role} onChange={(event) => setVolunteerForm({ ...volunteerForm, role: event.target.value })}><option>Event Support</option><option>Mentorship</option><option>Family Resource Outreach</option><option>Donation Drives</option><option>Setup and Cleanup</option></select>
            </div>
            <div>
              <label>Availability</label>
              <input value={volunteerForm.availability} onChange={(event) => setVolunteerForm({ ...volunteerForm, availability: event.target.value })} placeholder="Weekends, evenings, specific dates..." />
            </div>
          </div>
          <div className="volunteerEventList">
            {data.events.map((event) => (
              <article className="feedPost" key={event._id}>
                <div className="feedPostHead">
                  <div>
                    <p className="eyebrow">{event.category}</p>
                    <h2>{event.title}</h2>
                  </div>
                  <span>{formatDate(event)}</span>
                </div>
                {event.imageUrl ? <img className="feedImage" src={event.imageUrl} alt={event.title} /> : null}
                <div className="feedFacts">
                  <span>{event.location}</span>
                  <span>{event.volunteerCount || 0} volunteer{(event.volunteerCount || 0) === 1 ? "" : "s"}</span>
                </div>
                <p>{event.description}</p>
                <button className="btn green" disabled={volunteeredEventIds.has(event._id)} onClick={() => volunteer(event._id)}>
                  {volunteeredEventIds.has(event._id) ? "Volunteer List Joined" : "Volunteer for this Event"}
                </button>
              </article>
            ))}
            {!data.events.length ? <p className="notice">No events are available for volunteers right now.</p> : null}
          </div>
        </section>
      );
    }
    if (activeTab === "gym") {
      const incomingRequests = gymData.requests.filter((request) => request.recipientEmail === client?.email && request.status === "pending");
      const sentRequests = gymData.requests.filter((request) => request.requesterEmail === client?.email);
      const acceptedRequests = gymData.requests.filter((request) => request.status === "accepted");
      return (
        <div className="gymPartnerView">
          <section className="memberToolPanel wideToolPanel">
            <p className="eyebrow">Find a Gym Partner</p>
            <h1>Train with accountability.</h1>
            <p>Opt in with your schedule and goals. Suggested partners only see limited profile details until a connection is accepted.</p>
            <form className="gymProfileForm" onSubmit={saveGymProfile}>
              <div>
                <label>Preferred Gym or Area</label>
                <input value={gymForm.preferredGym} onChange={(event) => setGymForm({ ...gymForm, preferredGym: event.target.value })} placeholder="Downtown Y, home gym, North End..." />
              </div>
              <div>
                <label>Fitness Level</label>
                <select value={gymForm.fitnessLevel} onChange={(event) => setGymForm({ ...gymForm, fitnessLevel: event.target.value })}>
                  <option>Getting Started</option>
                  <option>Returning</option>
                  <option>Consistent</option>
                  <option>Advanced</option>
                </select>
              </div>
              <div className="editorWide">
                <label>Workout Days</label>
                <div className="choiceGrid">
                  {dayOptions.map((day) => <button className={gymForm.days.includes(day) ? "choice active" : "choice"} type="button" key={day} onClick={() => toggleGymList("days", day)}>{day}</button>)}
                </div>
              </div>
              <div className="editorWide">
                <label>Best Times</label>
                <div className="choiceGrid">
                  {timeOptions.map((time) => <button className={gymForm.times.includes(time) ? "choice active" : "choice"} type="button" key={time} onClick={() => toggleGymList("times", time)}>{time}</button>)}
                </div>
              </div>
              <div className="editorWide">
                <label>Goals</label>
                <div className="choiceGrid">
                  {goalOptions.map((goal) => <button className={gymForm.goals.includes(goal) ? "choice active" : "choice"} type="button" key={goal} onClick={() => toggleGymList("goals", goal)}>{goal}</button>)}
                </div>
              </div>
              <div>
                <label>Partner Preference</label>
                <input value={gymForm.partnerPreference} onChange={(event) => setGymForm({ ...gymForm, partnerPreference: event.target.value })} placeholder="Beginner friendly, same goals, accountability..." />
              </div>
              <div>
                <label>Transportation</label>
                <input value={gymForm.transportation} onChange={(event) => setGymForm({ ...gymForm, transportation: event.target.value })} placeholder="Drive, bus, need nearby..." />
              </div>
              <div className="editorWide">
                <label>Notes</label>
                <textarea rows="3" value={gymForm.notes} onChange={(event) => setGymForm({ ...gymForm, notes: event.target.value })} placeholder="Anything helpful for matching." />
              </div>
              <label className="checkLabel"><input type="checkbox" checked={gymForm.active} onChange={(event) => setGymForm({ ...gymForm, active: event.target.checked })} /> Available for matching</label>
              <button className="btn green">Save Gym Partner Profile</button>
            </form>
          </section>

          <section className="memberToolPanel wideToolPanel">
            <div className="feedPostHead">
              <div>
                <p className="eyebrow">Suggested Partners</p>
                <h2>{gymData.matches.length} match{gymData.matches.length === 1 ? "" : "es"}</h2>
              </div>
              <button className="btn" type="button" onClick={loadGymData}>Refresh</button>
            </div>
            <div className="miniForm">
              <label>Optional Request Message</label>
              <input value={gymMessage} onChange={(event) => setGymMessage(event.target.value)} placeholder="Want to meet for mornings, weekends, or a first workout?" />
            </div>
            <div className="matchGrid">
              {gymData.matches.map((match) => (
                <article className="matchCard" key={match._id}>
                  <div className="feedPostHead">
                    <div>
                      <h3>{match.name}</h3>
                      <p>{match.neighborhood || "Neighborhood not listed"}</p>
                    </div>
                    <span>{match.score} point{match.score === 1 ? "" : "s"}</span>
                  </div>
                  <div className="feedFacts">
                    {match.preferredGym ? <span>{match.preferredGym}</span> : null}
                    <span>{match.fitnessLevel}</span>
                    {match.days.slice(0, 3).map((day) => <span key={day}>{day}</span>)}
                    {match.times.slice(0, 2).map((time) => <span key={time}>{time}</span>)}
                  </div>
                  <p>{match.goals.join(", ") || "Goals not listed"}</p>
                  {match.notes ? <p>{match.notes}</p> : null}
                  <div className="miniActions">
                    <button className="btn green" disabled={match.alreadyRequested} onClick={() => requestGymPartner(match._id)}>{match.alreadyRequested ? "Request Pending" : "Request Gym Partner"}</button>
                    <button className="btn danger" onClick={() => reportGymIssue({ gymProfileId: match._id, reportedEmail: match.email })}>Report</button>
                  </div>
                </article>
              ))}
              {!gymData.profile ? <p className="notice">Save your gym partner profile to see suggested partners.</p> : null}
              {gymData.profile && !gymData.matches.length ? <p className="notice">No matches yet. Try adding more days, times, or goals.</p> : null}
            </div>
          </section>

          <section className="memberToolPanel wideToolPanel">
            <p className="eyebrow">Connection Requests</p>
            <div className="reportControls">
              <label>Report Reason</label>
              <select value={reportDraft.reason} onChange={(event) => setReportDraft({ ...reportDraft, reason: event.target.value })}>
                <option>Safety concern</option>
                <option>Harassment</option>
                <option>Spam or scam</option>
                <option>Inappropriate behavior</option>
                <option>Other</option>
              </select>
              <label>Report / Block Notes</label>
              <input value={reportDraft.details} onChange={(event) => setReportDraft({ ...reportDraft, details: event.target.value })} placeholder="Optional details for the admin team" />
            </div>
            <div className="requestList">
              {incomingRequests.map((request) => (
                <div className="listItem" key={request._id}>
                  <h3>{request.requesterName}</h3>
                  {request.message ? <p>{request.message}</p> : <p>Wants to connect as a gym partner.</p>}
                  <div className="miniActions">
                    <button className="btn green" onClick={() => respondGymRequest(request._id, "accepted")}>Accept</button>
                    <button className="btn danger" onClick={() => respondGymRequest(request._id, "declined")}>Decline</button>
                    <button className="btn danger" onClick={() => reportGymIssue({ requestId: request._id, reportedEmail: request.requesterEmail })}>Report</button>
                    <button className="btn danger" onClick={() => blockGymUser(request.requesterEmail)}>Block</button>
                  </div>
                </div>
              ))}
              {sentRequests.map((request) => (
                <div className="listItem" key={request._id}>
                  <h3>{request.recipientName}</h3>
                  <p>Status: {request.status}</p>
                </div>
              ))}
              {acceptedRequests.map((request) => {
                const partnerName = request.requesterEmail === client?.email ? request.recipientName : request.requesterName;
                const partnerEmail = request.requesterEmail === client?.email ? request.recipientEmail : request.requesterEmail;
                return (
                  <div className="listItem" key={`accepted-${request._id}`}>
                    <h3>{partnerName}</h3>
                    <p>Accepted gym partner connection.</p>
                    <a href={`mailto:${partnerEmail}`}>{partnerEmail}</a>
                    <div className="messageThread">
                      {(gymData.messages || []).filter((message) => message.requestId === request._id).map((message) => (
                        <div className={message.senderEmail === client?.email ? "messageBubble mine" : "messageBubble"} key={message._id}>
                          <b>{message.senderName}</b>
                          <p>{message.body}</p>
                        </div>
                      ))}
                      <div className="messageComposer">
                        <input value={messageDrafts[request._id] || ""} onChange={(event) => setMessageDrafts({ ...messageDrafts, [request._id]: event.target.value })} placeholder={`Message ${partnerName}`} />
                        <button className="btn green" onClick={() => sendGymMessage(request._id)}>Send</button>
                      </div>
                    </div>
                    <div className="miniActions">
                      <button className="btn danger" onClick={() => reportGymIssue({ requestId: request._id, reportedEmail: partnerEmail })}>Report</button>
                      <button className="btn danger" onClick={() => blockGymUser(partnerEmail)}>Block</button>
                    </div>
                  </div>
                );
              })}
              {!gymData.requests.length ? <p className="notice">No gym partner requests yet.</p> : null}
            </div>
          </section>
        </div>
      );
    }
    if (activeTab === "friends") {
      return (
        <section className="memberToolPanel wideToolPanel">
          <p className="eyebrow">My Friends</p>
          <h1>Your circle will live here.</h1>
          <p>Member connections, gym partners, mentors, and event friends will appear here once friend features are connected.</p>
        </section>
      );
    }
    return (
      <div className="profileView">
        <section className="memberToolPanel wideToolPanel">
          <p className="eyebrow">Profile</p>
          <h1>{client?.name || "Create your profile"}</h1>
          <p>{client?.email || "Create a member profile so you can RSVP and use member features."}</p>
        </section>
        <SignupForm onRegister={registerClient} onError={setStatus} />
      </div>
    );
  }

  return (
    <>
      <PortalNav />
      <section className="dash memberDash">
        <div className="memberWrap">
          <aside className="memberSidebar">
            <div className="memberIdentity">
              <b>{client?.name || "Guest"}</b>
              <span>{client?.email || "Sign in to use member features"}</span>
              <button className="btn" type="button" onClick={() => void signOut()}>Sign Out</button>
            </div>
            <div className="sectionTabList">
              {tabs.map(([tab, label]) => (
                <button className={`tab ${activeTab === tab ? "active" : ""}`} key={tab} onClick={() => {
                  setActiveTab(tab);
                }}>{label}</button>
              ))}
            </div>
          </aside>

          <main className="memberMain">
            {status ? <p className="notice">{status}</p> : null}
            {tabContent()}
          </main>
        </div>
      </section>
    </>
  );
}
