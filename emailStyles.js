
const styles = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  body {
    font-family: 'Inter', sans-serif;
    margin: 0;
    padding: 0;
  }
  .background {
	width: 100%;
	background-color: #111827;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    border-radius: 1rem;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
	padding-top: 1px;
  }
  .header {
    background-color: #374151;
    color: #fb923c;
    padding: 20px;
    text-align: center;
    border-radius: 1rem;
	border: solid 1px grey;
	box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.25) 0px 25px 50px -12px;
	margin-Bottom: 24px;
	margin-top: 24px;
  }
  .content {
    padding: 20px;
	border: solid 1px grey;
	border-radius: 1rem;
	margin-Bottom: 24px;
	background-color: #1f2937;
	color: white;
	text-align: center;
  }
  .footer {
    text-align: center;
    font-size: 12px;
    color: #fb923c;
    margin-top: 20px;
	padding-bottom: 1px;
  }
  .button {
    display: inline-block;
    background-color: #ea580c;
    color: #fff;
    padding: 10px 20px;
    border-radius: 5px;
    text-decoration: none;
    font-weight: bold;
  }
</style>
`;

module.exports = { styles };
