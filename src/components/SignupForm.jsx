import { interests } from "../lib/portalData";

export function SignupForm({ onRegister, onError }) {
  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await onRegister({
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        dateOfBirth: form.dateOfBirth.value,
        interests: form.interests.value,
        neighborhood: form.neighborhood.value.trim(),
        familyRole: form.familyRole.value,
        preferredContact: form.preferredContact.value,
        supportNeeds: form.supportNeeds.value.trim()
      });
      form.reset();
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2>Join The Anchor</h2>
      <p className="notice">Create your member profile to RSVP, find resources, and stay connected.</p>
      <label>Full Name</label>
      <input name="name" required />
      <label>Email</label>
      <input name="email" type="email" required />
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
      <button className="btn green">Create Member Profile</button>
    </form>
  );
}
