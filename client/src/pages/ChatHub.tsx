import { Link } from "react-router-dom";

const ChatHub = () => {
  return (
    <section className="hub-page">
      <header>
        <h2>Chat</h2>
        <p>Jump into a project workspace to collaborate in real time.</p>
      </header>
      <div className="state-card">
        <p>Select a project to open its chat channel.</p>
        <Link className="primary-button" to="/dashboard">
          Browse projects
        </Link>
      </div>
    </section>
  );
};

export default ChatHub;
