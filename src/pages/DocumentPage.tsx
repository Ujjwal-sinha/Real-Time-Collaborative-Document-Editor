import React from 'react';

const DocumentPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Document Editor</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p>This will be the collaborative document editor.</p>
        </div>
      </div>
    </div>
  );
};

export default DocumentPage;