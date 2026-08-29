import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { LoginDto } from '../auth/dto/login.dto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

const ADMIN_COOKIE = 'flenvn_admin_token';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  index(@Res() res: Response) {
    return res.redirect('/api/v1/admin/users');
  }

  @Get('login')
  loginPage(@Res() res: Response) {
    return res.type('html').send(this.renderLoginPage());
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res() res: Response) {
    const login = await this.authService.login(loginDto);

    if (!login.user.isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    const adminToken = await this.jwtService.signAsync(
      { sub: login.user.id },
      { expiresIn: '8h' },
    );
    const secure = this.isSecureRequest(res.req) ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE}=${adminToken}; HttpOnly; SameSite=Lax; Path=/admin; Max-Age=28800${secure}`,
    );

    return res.json({ success: true, redirectTo: '/admin/users' });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res() res: Response) {
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE}=; HttpOnly; SameSite=Lax; Path=/admin; Max-Age=0`,
    );
    return res.redirect('/api/v1/admin/login');
  }

  @Get('users')
  async usersPage(@Req() req: Request, @Res() res: Response) {
    const admin = await this.requireAdmin(req);
    const users = await this.usersService.getAllUsers();

    return res.type('html').send(this.renderUsersPage(users, admin));
  }

  @Post('users/:id/verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.requireAdmin(req);
    await this.usersService.verifyEmailById(id);
    return res.json({ success: true });
  }

  private async requireAdmin(req: Request): Promise<User> {
    const token = this.getCookie(req, ADMIN_COOKIE);

    if (!token) {
      throw new UnauthorizedException('Admin login required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      const user = await this.authService.validateUser(payload.sub);

      if (!user?.isAdmin) {
        throw new UnauthorizedException('Admin access required');
      }

      return user;
    } catch {
      throw new UnauthorizedException('Admin login required');
    }
  }

  private getCookie(req: Request, name: string): string | undefined {
    const cookies = req.headers.cookie?.split(';') || [];
    const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));
    return cookie?.split('=').slice(1).join('=');
  }

  private isSecureRequest(req?: Request): boolean {
    return (
      req?.secure === true ||
      req?.headers['x-forwarded-proto']?.toString().split(',')[0] === 'https'
    );
  }

  private renderLoginPage(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FLENVN Admin</title>
  <style>${this.styles()}</style>
</head>
<body>
  <main class="login-shell">
    <form id="loginForm" class="panel">
      <h1>FLENVN Admin</h1>
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <p id="error" class="error"></p>
      <button type="submit">Sign in</button>
    </form>
  </main>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const error = document.getElementById('error');
      error.textContent = '';
      const response = await fetch('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.value,
          password: form.password.value
        })
      });
      if (!response.ok) {
        error.textContent = 'Invalid admin login';
        return;
      }
      window.location.href = '/api/v1/admin/users';
    });
  </script>
</body>
</html>`;
  }

  private renderUsersPage(
    users: Array<Record<string, unknown>>,
    admin: User,
  ): string {
    const rows = users
      .map((user) => {
        const id = this.escape(String(user.id));
        const verified = Boolean(user.isEmailVerified);
        const adminLabel = Boolean(user.isAdmin) ? 'Admin' : 'User';

        return `<tr>
          <td><strong>${this.escape(String(user.email))}</strong><span>${this.escape(String(user.username || 'No username'))}</span></td>
          <td>${verified ? '<span class="badge ok">Verified</span>' : '<span class="badge warn">Pending</span>'}</td>
          <td><span class="badge">${adminLabel}</span></td>
          <td>${this.escape(String(user.booksCount ?? 0))}</td>
          <td>${this.escape(String(user.totalWordsUsed ?? 0))}</td>
          <td>${this.formatDate(user.createdAt)}</td>
          <td>${verified ? '' : `<button class="verify" data-user-id="${id}">Verify</button>`}</td>
        </tr>`;
      })
      .join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Users - FLENVN Admin</title>
  <style>${this.styles()}</style>
</head>
<body>
  <header>
    <div>
      <h1>Users</h1>
      <p>${users.length} accounts · signed in as ${this.escape(admin.email)}</p>
    </div>
    <form method="post" action="/admin/logout"><button type="submit" class="secondary">Sign out</button></form>
  </header>
  <main class="table-shell">
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Role</th>
          <th>Books</th>
          <th>Words</th>
          <th>Created</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
  <script>
    document.querySelectorAll('.verify').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        const response = await fetch('/api/v1/admin/users/' + button.dataset.userId + '/verify-email', { method: 'POST' });
        if (response.ok) {
          window.location.reload();
          return;
        }
        button.disabled = false;
        alert('Could not verify this user');
      });
    });
  </script>
</body>
</html>`;
  }

  private styles(): string {
    return `body{margin:0;background:#f7f8fa;color:#17202a;font-family:Arial,sans-serif}button{height:38px;border:0;border-radius:6px;background:#1769e0;color:white;font-weight:700;padding:0 16px;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.secondary{background:#e8edf5;color:#17202a}.login-shell{min-height:100vh;display:grid;place-items:center;padding:24px}.panel{width:min(380px,100%);background:white;border:1px solid #dde3ea;border-radius:8px;padding:24px;box-shadow:0 12px 30px rgba(30,43,60,.08)}h1{margin:0;font-size:28px}label{display:grid;gap:8px;margin-top:18px;font-weight:700}input{height:40px;border:1px solid #c9d3df;border-radius:6px;padding:0 12px;font:inherit}.error{min-height:20px;color:#b42318}header{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 28px;background:white;border-bottom:1px solid #dde3ea}header p{margin:6px 0 0;color:#667085}.table-shell{padding:28px;overflow:auto}table{width:100%;border-collapse:collapse;background:white;border:1px solid #dde3ea;border-radius:8px;overflow:hidden}th,td{text-align:left;padding:14px;border-bottom:1px solid #edf1f5;white-space:nowrap}th{font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.04em}td span{display:block;color:#667085;margin-top:4px}.badge{display:inline-block;margin:0;padding:4px 8px;border-radius:999px;background:#eef2f6;color:#344054;font-size:12px;font-weight:700}.badge.ok{background:#dcfae6;color:#067647}.badge.warn{background:#fff4cc;color:#936a00}@media(max-width:720px){header{align-items:flex-start;flex-direction:column}.table-shell{padding:12px}th,td{padding:12px 10px}}`;
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return map[char];
    });
  }

  private formatDate(value: unknown): string {
    if (!value) {
      return '';
    }

    return this.escape(new Date(String(value)).toLocaleString());
  }
}
