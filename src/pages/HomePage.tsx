import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Document Dashboard</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p>Welcome to the collaborative document editor!</p>
          <p>This page will show your documents list.</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;