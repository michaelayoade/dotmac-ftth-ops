import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SecretsManager = ({ authToken }) => {
  const [secrets, setSecrets] = useState([]);
  const [selectedSecret, setSelectedSecret] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  const API_BASE = 'http://localhost:8000/api/v1';

  // Common application secrets that can be edited
  const editableSecrets = [
    { path: 'smtp/username', label: 'Email Username', type: 'email' },
    { path: 'smtp/password', label: 'Email Password', type: 'password' },
    { path: 'app/site_name', label: 'Site Name', type: 'text' },
    { path: 'app/support_email', label: 'Support Email', type: 'email' },
    { path: 'storage/bucket_name', label: 'Storage Bucket', type: 'text' },
    { path: 'app/max_upload_size', label: 'Max Upload Size (MB)', type: 'number' },
    { path: 'app/maintenance_mode', label: 'Maintenance Mode', type: 'boolean' },
  ];

  // Fetch a secret value
  const fetchSecret = async (path) => {
    try {
      const response = await axios.get(`${API_BASE}/secrets/secrets/${path}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return response.data.data;
    } catch (error) {
      console.error(`Failed to fetch ${path}:`, error);
      return null;
    }
  };

  // Update a secret
  const updateSecret = async (path, value) => {
    setLoading(true);
    try {
      await axios.post(
        `${API_BASE}/secrets/secrets/${path}`,
        { data: { value } },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      alert(`Secret ${path} updated successfully!`);
      await loadSecrets();
    } catch (error) {
      alert(`Failed to update secret: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load all editable secrets
  const loadSecrets = async () => {
    const loadedSecrets = [];
    for (const secret of editableSecrets) {
      const data = await fetchSecret(secret.path);
      loadedSecrets.push({
        ...secret,
        currentValue: data?.value || ''
      });
    }
    setSecrets(loadedSecrets);
  };

  useEffect(() => {
    loadSecrets();
  }, [authToken]);

  return (
    <div className="secrets-manager">
      <h2>🔐 Secrets Management</h2>

      <div className="secrets-grid">
        {secrets.map(secret => (
          <div key={secret.path} className="secret-card">
            <h3>{secret.label}</h3>
            <p className="secret-path">Path: {secret.path}</p>

            <div className="secret-input-group">
              {secret.type === 'boolean' ? (
                <select
                  value={formData[secret.path] || secret.currentValue}
                  onChange={e => setFormData({
                    ...formData,
                    [secret.path]: e.target.value
                  })}
                >
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              ) : (
                <input
                  type={secret.type}
                  placeholder={secret.type === 'password' ? '••••••••' : 'Enter value'}
                  value={formData[secret.path] || ''}
                  onChange={e => setFormData({
                    ...formData,
                    [secret.path]: e.target.value
                  })}
                />
              )}

              <button
                onClick={() => updateSecret(secret.path, formData[secret.path])}
                disabled={loading || !formData[secret.path]}
              >
                Update
              </button>
            </div>

            {secret.type !== 'password' && secret.currentValue && (
              <p className="current-value">
                Current: {secret.currentValue}
              </p>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .secrets-manager {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .secrets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .secret-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          background: #f9f9f9;
        }

        .secret-card h3 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .secret-path {
          font-size: 12px;
          color: #666;
          font-family: monospace;
          margin-bottom: 15px;
        }

        .secret-input-group {
          display: flex;
          gap: 10px;
        }

        .secret-input-group input,
        .secret-input-group select {
          flex: 1;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }

        .secret-input-group button {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .secret-input-group button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .current-value {
          margin-top: 10px;
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default SecretsManager;