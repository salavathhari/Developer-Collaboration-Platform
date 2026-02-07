import { useState } from "react";

import { uploadFile } from "../services/fileService";
import type { FileAsset } from "../types";

type FileUploaderProps = {
  projectId: string;
  onUploaded: (file: FileAsset) => void;
};

const FileUploader = ({ projectId, onUploaded }: FileUploaderProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const uploaded = await uploadFile(projectId, file);
      onUploaded(uploaded);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="file-uploader">
      <label className="secondary-button light" htmlFor="fileUpload">
        {loading ? "Uploading..." : "Attach file"}
      </label>
      <input id="fileUpload" type="file" hidden onChange={handleChange} />
      {error ? <span className="file-error">{error}</span> : null}
    </div>
  );
};

export default FileUploader;
