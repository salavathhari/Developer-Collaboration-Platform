import { Link } from "react-router-dom";

const FilesHub = () => {
  return (
    <section className="hub-page">
      <header>
        <h2>Files</h2>
        <p>Store assets, specs, and shared project documents.</p>
      </header>
      <div className="state-card">
        <p>Select a project to manage shared files.</p>
        <Link className="primary-button" to="/dashboard">
          Browse projects
        </Link>
      </div>
    </section>
  );
};

export default FilesHub;
