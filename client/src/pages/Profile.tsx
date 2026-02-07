import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { updateProfile, uploadAvatar } from "../services/authService";
import { useAuth } from "../hooks/useAuth";

const Profile = () => {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    try {
      await updateProfile({ name, email, bio });
      await refreshProfile();
      setStatus("Profile updated.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update profile.");
    }
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      await uploadAvatar(file);
      await refreshProfile();
      setStatus("Avatar updated.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Avatar upload failed.");
    }
  };

  return (
    <section className="profile">
      <header>
        <h2>Profile settings</h2>
        <p>Manage personal details for your collaboration space.</p>
      </header>

      <div className="profile-grid">
        <div className="profile-card">
          <div className="avatar-block">
            <div className="avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                <span>{user?.name?.[0] || "U"}</span>
              )}
            </div>
            <label className="secondary-button" htmlFor="avatarUpload">
              Upload avatar
            </label>
            <input
              id="avatarUpload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              hidden
            />
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="field">
            <span>Name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field">
            <span>Email</span>
            <input
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <span>Bio</span>
            <textarea
              className="input textarea"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
            />
          </div>

          {status ? <div className="form-alert success">{status}</div> : null}
          {error ? <div className="form-alert error">{error}</div> : null}

          <button className="primary-button" type="submit">
            Save changes
          </button>
        </form>
      </div>
    </section>
  );
};

export default Profile;
