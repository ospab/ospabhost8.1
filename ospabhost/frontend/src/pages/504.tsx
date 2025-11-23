import ErrorPage from '../components/ErrorPage';

export default function GatewayTimeout() {
  return (
    <ErrorPage
      code="504"
      title="Превышено время ожидания"
      description="Сервер не дождался ответа от вышестоящего сервера. Это может быть вызвано временными проблемами с сетью."
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      color="orange"
      showLoginButton={false}
      showBackButton={true}
      showHomeButton={true}
    />
  );
}
