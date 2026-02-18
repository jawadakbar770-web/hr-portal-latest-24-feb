import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="text-center text-white">
        <div className="mb-8">
          <h1 className="text-9xl font-bold mb-4 drop-shadow-lg">404</h1>
          <p className="text-4xl font-bold mb-2">Page Not Found</p>
          <p className="text-blue-100 text-lg">The page you're looking for doesn't exist.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition font-semibold"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            <Home size={20} />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}