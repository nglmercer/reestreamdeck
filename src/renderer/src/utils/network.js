export const getHostname = () => {
    let localhostname = "localhost";
    if (window.location.hostname && !window.location.hostname.includes("file") && window.location.hostname.length > 0) {
      localhostname = window.location.hostname;
    }
    return localhostname;
  };

  export const getPort = async () => {
    if (window.location.protocol === "file:") {
      return 3333; // Usar el puerto por defecto si es `file://`
    }

    const windowPort = window.location.port;

    return windowPort || 3333;
  };
