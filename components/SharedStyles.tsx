import { FC } from 'react';

export const SharedStyles = `
  body {
    background-color: #0A0F1A;
    margin: 0;
    color: #D1D5DB;
    font-family: 'Inter', system-ui, sans-serif;
    font-weight: 400;
    letter-spacing: -0.015em;
    line-height: 1.6;
    padding-top: 4rem; /* Reduced padding for more compact layout */
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    letter-spacing: -0.035em;
    font-weight: 700;
    line-height: 1.25;
    color: #F3F4F6;
  }
    
  .gradient-text {
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 50%, #C084FC 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 30px rgba(168, 85, 247, 0.25);
    font-family: 'Space Grotesk', 'Euclid Circular A', 'Syne', 'Chakra Petch', system-ui, sans-serif;
    letter-spacing: -0.03em;
    font-weight: 700;
  }

  .neon-text {
    color: #E0E7FF;
    text-shadow: 0 0 10px rgba(167, 139, 250, 0.3);
  }

  .neon-text-subtle {
    color: #CBD5E1;
    text-shadow: 0 0 8px rgba(167, 139, 250, 0.2);
  }

  /* Navigation Styles */
  .nav-container {
    background: rgba(10, 15, 26, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(56, 189, 248, 0.15);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    padding: 0.5rem 0;
    transition: all 0.3s ease;
  }

  .nav-content {
    max-width: 80rem;
    margin: 0 auto;
    padding: 0 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 3rem;
  }

  .nav-brand {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.025em;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 20px rgba(168, 85, 247, 0.25);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.3s ease;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
  }

  .nav-brand:hover {
    text-shadow: 0 0 30px rgba(168, 85, 247, 0.35);
    transform: scale(1.02);
    background: rgba(56, 189, 248, 0.1);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(15, 23, 42, 0.4);
    padding: 0.25rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
  }

  .nav-link {
    position: relative;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
    color: #CBD5E1;
    text-align: center;
    white-space: nowrap;
    letter-spacing: -0.01em;
    text-decoration: none;
  }

  .nav-link:hover {
    background: rgba(56, 189, 248, 0.1);
    color: #E2E8F0;
    transform: translateY(-1px);
  }

  .nav-link.active {
    color: #38BDF8;
    background: rgba(56, 189, 248, 0.15);
    font-weight: 600;
  }

  .nav-link.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 2px;
    background: linear-gradient(to right, #38BDF8, #A855F7);
    border-radius: 1px;
  }

  .nav-button {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #E2E8F0;
    padding: 0.375rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    z-index: 1;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    text-decoration: none;
  }

  .nav-button:hover {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%);
    border-color: rgba(168, 85, 247, 0.5);
    color: #F3F4F6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
  }

  .nav-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(168, 85, 247, 0.15);
  }

  .gradient-button {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #E2E8F0;
    padding: 0.5rem 1.25rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    z-index: 1;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    text-decoration: none;
  }

  .gradient-button:hover {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%);
    border-color: rgba(168, 85, 247, 0.5);
    color: #F3F4F6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
  }

  .gradient-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(168, 85, 247, 0.15);
  }

  .gradient-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%);
    z-index: -1;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .gradient-button:hover::before {
    opacity: 1;
  }

  /* Hero section styles */
  .hero-gradient {
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    position: relative;
    overflow: hidden;
  }

  .hero-gradient::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.3), transparent);
  }

  .hero-gradient::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.3), transparent);
  }

  .prometheus-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 3rem;
    line-height: 1.15;
    letter-spacing: -0.04em;
    font-weight: 800;
    text-shadow: 0 0 30px rgba(168, 85, 247, 0.25);
    margin-bottom: 1.5rem;
    text-align: center;
    display: block;
    width: 100%;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 50%, #C084FC 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    padding: 0.5rem 0;
  }

  .subtitle-box {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 0.5rem;
    padding: 1.25rem;
    margin: 0 auto 2rem;
    max-width: 42rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .subtitle-box::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.3), transparent);
  }

  .subtitle-box:hover {
    background: rgba(15, 23, 42, 0.7);
    border-color: rgba(56, 189, 248, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1), 0 0 12px rgba(56, 189, 248, 0.15);
  }

  .section-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 2.25rem;
    line-height: 1.2;
    letter-spacing: -0.03em;
    font-weight: 700;
    text-align: center;
    display: block;
    width: 100%;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .section-subtitle {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 1.125rem;
    line-height: 1.5;
    letter-spacing: -0.01em;
    font-weight: 400;
    text-align: center;
    display: block;
    width: 100%;
    color: #94A3B8;
  }

  /* Feature card styles */
  .feature-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 0.5rem;
    padding: 1.25rem;
    transition: all 0.3s ease;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    max-width: 320px;
    margin: 0 auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .feature-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.3), transparent);
  }

  .feature-card:hover {
    background: rgba(15, 23, 42, 0.7);
    border-color: rgba(56, 189, 248, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1), 0 0 12px rgba(56, 189, 248, 0.15);
  }

  .feature-card .icon-container {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(56, 189, 248, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 0.75rem;
    transition: all 0.3s ease;
  }

  .feature-card:hover .icon-container {
    background: rgba(56, 189, 248, 0.2);
    transform: scale(1.1);
  }

  .card-title {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 1.125rem;
    line-height: 1.3;
    letter-spacing: -0.02em;
    font-weight: 700;
    text-align: center;
    display: block;
    width: 100%;
    margin-bottom: 0.75rem;
    color: #E2E8F0;
  }

  .card-subtitle {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    line-height: 1.5;
    letter-spacing: -0.01em;
    font-weight: 400;
    text-align: center;
    display: block;
    width: 100%;
    color: #94A3B8;
  }

  /* Step card styles */
  .step-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 0.5rem;
    padding: 1.5rem;
    transition: all 0.3s ease;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    max-width: 320px;
    margin: 0 auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .step-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.3), transparent);
  }

  .step-card:hover {
    background: rgba(15, 23, 42, 0.7);
    border-color: rgba(56, 189, 248, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1), 0 0 12px rgba(56, 189, 248, 0.15);
  }

  .step-number {
    font-size: 2.5rem;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 0.75rem;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    opacity: 0.3;
    transition: opacity 0.3s ease;
    font-family: 'Space Grotesk', system-ui, sans-serif;
    letter-spacing: -0.04em;
    text-align: center;
  }

  .step-card:hover .step-number {
    opacity: 0.5;
  }

  /* Grid layouts */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Footer styles */
  footer {
    background: rgba(10, 15, 26, 0.8);
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(56, 189, 248, 0.15);
    padding: 3rem 0 2rem;
    margin-top: 5rem;
  }

  .footer-content {
    max-width: 80rem;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  .footer-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 2rem;
    margin-bottom: 3rem;
  }

  .footer-brand {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .footer-description {
    font-size: 0.875rem;
    line-height: 1.5;
    color: #94A3B8;
    margin-bottom: 1.5rem;
  }

  .footer-heading {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #CBD5E1;
    margin-bottom: 1rem;
  }

  .footer-links {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .footer-link {
    font-size: 0.875rem;
    color: #94A3B8;
    transition: color 0.2s ease;
    text-decoration: none;
  }

  .footer-link:hover {
    color: #C084FC;
  }

  .footer-bottom {
    border-top: 1px solid rgba(56, 189, 248, 0.1);
    margin-top: 3rem;
    padding-top: 2rem;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .footer-copyright {
    font-size: 0.75rem;
    color: #64748B;
  }

  .footer-social {
    display: flex;
    gap: 1.5rem;
  }

  .footer-social-link {
    font-size: 0.75rem;
    color: #64748B;
    transition: color 0.2s ease;
    text-decoration: none;
  }

  .footer-social-link:hover {
    color: #C084FC;
  }

  /* Responsive adjustments */
  @media (min-width: 768px) {
    .footer-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  /* Document Review Page Styles */
  .card {
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.75rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }

  .card:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
    transform: translateY(-2px);
  }

  /* Summary Section Styles */
  .summary-section {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
  }

  .summary-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .summary-title-green {
    color: #34D399;
  }

  .summary-title-red {
    color: #FB7185;
  }

  .summary-title-blue {
    color: #60A5FA;
  }

  .summary-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 0.5rem;
  }

  .summary-dot-green {
    background-color: #34D399;
    box-shadow: 0 0 10px rgba(52, 211, 153, 0.5);
  }

  .summary-dot-red {
    background-color: #FB7185;
    box-shadow: 0 0 10px rgba(251, 113, 133, 0.5);
  }

  .summary-dot-blue {
    background-color: #60A5FA;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.5);
  }

  .summary-text {
    color: #E2E8F0;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  /* Stats Section Styles */
  .stats-container {
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.75rem;
    padding: 2rem;
    margin-bottom: 2rem;
    border: 1px solid rgba(56, 189, 248, 0.15);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .stats-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .next-steps-section {
    margin-bottom: 2rem;
  }

  .next-steps-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #E2E8F0;
  }

  .next-steps-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }

  .priority-areas {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
  }

  .priority-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #E2E8F0;
  }

  .priority-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .priority-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.375rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
  }

  .priority-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 100%);
    border-radius: 50%;
    color: white;
    font-weight: 600;
    font-size: 0.75rem;
  }

  .priority-details {
    display: flex;
    flex-direction: column;
  }

  .priority-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #E2E8F0;
  }

  .priority-value {
    font-size: 0.75rem;
    color: #94A3B8;
  }

  .action-path {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
  }

  .action-path-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #E2E8F0;
  }

  .action-steps {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .action-step {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .action-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #94A3B8;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .action-indicator.completed {
    background: linear-gradient(135deg, #34D399 0%, #10B981 100%);
    border: none;
    color: white;
  }

  .action-indicator.active {
    background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%);
    border: none;
    color: white;
  }

  .action-label {
    font-size: 0.875rem;
    color: #E2E8F0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }

  .stats-section {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
  }

  .stats-section-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #E2E8F0;
  }

  .stats-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
  }

  .stats-label {
    font-size: 0.875rem;
    color: #94A3B8;
  }

  .stats-value {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .stats-value-total {
    color: #60A5FA;
  }

  .stats-value-filled {
    color: #34D399;
  }

  .stats-value-completion {
    color: #A855F7;
  }

  .stats-value-missing {
    color: #FB7185;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stats-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #FB7185;
    box-shadow: 0 0 10px rgba(251, 113, 133, 0.5);
  }

  .application-score-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(56, 189, 248, 0.1);
  }

  .score-display {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .score-value {
    font-size: 2.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .score-max {
    font-size: 1.25rem;
    color: #94A3B8;
  }

  .score-label {
    font-size: 0.875rem;
    color: #94A3B8;
    margin-top: 0.25rem;
  }

  .stats-footer {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(56, 189, 248, 0.1);
  }

  .stats-info {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    color: #94A3B8;
  }

  /* Document Review Container */
  .document-review-container {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 2rem;
  }

  .document-selector {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
  }

  .document-selector-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #E2E8F0;
  }

  .document-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .document-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.375rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .document-item:hover {
    background: rgba(15, 23, 42, 0.8);
    border-color: rgba(56, 189, 248, 0.3);
  }

  .document-item.selected {
    background: rgba(56, 189, 248, 0.1);
    border-color: rgba(56, 189, 248, 0.5);
  }

  .document-icon {
    font-size: 1.25rem;
  }

  .document-name {
    flex: 1;
    font-size: 0.875rem;
    color: #E2E8F0;
  }

  .document-view-link {
    font-size: 0.75rem;
    color: #60A5FA;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .document-view-link:hover {
    color: #A855F7;
    text-decoration: underline;
  }

  .document-analysis {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
  }

  .analysis-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    color: #E2E8F0;
  }

  .summary-sections {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  /* Lawyer Form Styles */
  .lawyer-form-container {
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.75rem;
    padding: 2rem;
    margin-top: 2rem;
    border: 1px solid rgba(56, 189, 248, 0.15);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .lawyer-form-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .lawyer-form-description {
    font-size: 0.875rem;
    color: #94A3B8;
    margin-bottom: 1.5rem;
  }

  .lawyer-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #E2E8F0;
  }

  .form-input, .form-textarea {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 0.375rem;
    padding: 0.75rem;
    color: #E2E8F0;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .form-input:focus, .form-textarea:focus {
    outline: none;
    border-color: rgba(56, 189, 248, 0.5);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .submit-button {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #E2E8F0;
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: all 0.2s ease;
    cursor: pointer;
    margin-top: 1rem;
  }

  .submit-button:hover {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%);
    border-color: rgba(168, 85, 247, 0.5);
    color: #F3F4F6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
  }

  .submit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* Matched Lawyer Styles */
  .matched-lawyer-container {
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.75rem;
    padding: 2rem;
    margin-top: 2rem;
    border: 1px solid rgba(56, 189, 248, 0.15);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .matched-lawyer-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    background: linear-gradient(135deg, #60A5FA 0%, #A855F7 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .lawyer-card {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
  }

  .lawyer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .lawyer-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: #E2E8F0;
  }

  .match-score {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .match-score-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #34D399;
  }

  .match-score-label {
    font-size: 0.75rem;
    color: #94A3B8;
  }

  .lawyer-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .lawyer-detail {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .lawyer-detail-label {
    font-size: 0.75rem;
    color: #94A3B8;
  }

  .lawyer-detail-value {
    font-size: 0.875rem;
    color: #E2E8F0;
  }

  .lawyer-description {
    margin-bottom: 1.5rem;
  }

  .lawyer-description p {
    font-size: 0.875rem;
    color: #CBD5E1;
    line-height: 1.6;
  }

  .lawyer-actions {
    display: flex;
    gap: 1rem;
  }

  .contact-button, .find-another-button {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .contact-button {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #E2E8F0;
  }

  .contact-button:hover {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%);
    border-color: rgba(168, 85, 247, 0.5);
    color: #F3F4F6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
  }

  .find-another-button {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(56, 189, 248, 0.2);
    color: #94A3B8;
  }

  .find-another-button:hover {
    background: rgba(15, 23, 42, 0.8);
    border-color: rgba(56, 189, 248, 0.3);
    color: #E2E8F0;
    transform: translateY(-1px);
  }

  /* Next Steps Grid */
  .next-steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .next-step-card {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(56, 189, 248, 0.1);
    transition: all 0.3s ease;
  }

  .next-step-card:hover {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(56, 189, 248, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .next-step-icon {
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  .next-step-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: #E2E8F0;
  }

  .next-step-description {
    font-size: 0.875rem;
    color: #94A3B8;
    margin-bottom: 1.5rem;
  }

  .next-step-button {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #E2E8F0;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: all 0.2s ease;
    cursor: pointer;
    width: 100%;
  }

  .next-step-button:hover {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%);
    border-color: rgba(168, 85, 247, 0.5);
    color: #F3F4F6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
  }

  /* Primary Button */
  .primary-button {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #E2E8F0;
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .primary-button:hover {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%);
    border-color: rgba(168, 85, 247, 0.5);
    color: #F3F4F6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .document-review-container {
      grid-template-columns: 1fr;
    }
    
    .next-steps-content {
      grid-template-columns: 1fr;
    }
    
    .stats-grid {
      grid-template-columns: 1fr;
    }
    
    .lawyer-details {
      grid-template-columns: 1fr;
    }
    
    .lawyer-actions {
      flex-direction: column;
    }
  }
`;

export const BackgroundEffects: FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden z-0">
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary-500/20 rounded-full filter blur-3xl opacity-30 animate-pulse-slow"></div>
      <div className="absolute top-20 -right-20 w-60 h-60 bg-accent-500/20 rounded-full filter blur-3xl opacity-30 animation-delay-2000 animate-pulse-slow"></div>
      <div className="absolute bottom-20 left-20 w-60 h-60 bg-primary-500/20 rounded-full filter blur-3xl opacity-30 animation-delay-4000 animate-pulse-slow"></div>
      
      <div className="absolute inset-0 bg-dot-pattern bg-[length:30px_30px] opacity-10"></div>
    </div>
  );
};