// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const forms = {
    personal: document.getElementById('personalForm'),
    password: document.getElementById('passwordForm'),
    newUser: document.getElementById('newUserForm')
};
const menuToggle = document.getElementById('menuToggle');
const sidePanel = document.getElementById('sidePanel');
const sidePanelLogout = document.getElementById('sidePanelLogout');

const ADMIN_USER_ID = 1;

async function checkUserRole() {
    try {
        const response = await fetch('/api/user/me');
        const user = await response.json();
        
        const isAdmin = user.role_id === ADMIN_USER_ID;

        // Show/hide tabs based on role
        if (!isAdmin) {
            document.querySelector('[data-tab="newUser"]').style.display = 'none';
            document.querySelector('[data-tab="manageUsers"]').style.display = 'none';
            document.querySelector('[data-tab="auditLogs"]').style.display = 'none';
        }

        // Set initial form values with new column names
        document.getElementById('nombre').value = user.first_middle_name;
        document.getElementById('apellido').value = user.last_name;
        document.getElementById('email').value = user.email;
    } catch (error) {
        console.error('Error checking user role:', error);
    }
}

document.getElementById('toggleFilters').addEventListener('click', function() {
    const filtersContainer = document.querySelector('.filters-container');
    const button = this;
    
    filtersContainer.classList.toggle('collapsed');
    button.innerHTML = filtersContainer.classList.contains('collapsed') 
        ? '<i class="fas fa-filter"></i> Mostrar Filtros'
        : '<i class="fas fa-filter"></i> Ocultar Filtros';
});

// Add side panel toggle functionality
menuToggle.addEventListener('click', () => {
    sidePanel.classList.toggle('visible');
});

// Close panel when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        !sidePanel.contains(e.target) && 
        !menuToggle.contains(e.target) &&
        sidePanel.classList.contains('visible')) {
        sidePanel.classList.remove('visible');
    }
});

// Add logout functionality
sidePanelLogout.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login';
        } else {
            const message = await response.text();
            alert(message);
        }
    } catch (error) {
        console.error('Logout failed:', error);
        alert('Logout failed. Please try again.');
    }
});

// Tab Switching
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        
        // Update active states
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // Load data if needed
        if (tabId === 'manageUsers') loadUsers();
        if (tabId === 'auditLogs') loadAuditLogs();
    });
});

// Personal Information Form
forms.personal.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const formData = {
            nombre: document.getElementById('nombre').value,
            apellido: document.getElementById('apellido').value,
            email: document.getElementById('email').value
        };

        const response = await fetch('/api/user/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('Información personal actualizada correctamente');
        } else {
            throw new Error('Error al actualizar información');
        }
    } catch (error) {
        alert(error.message);
    }
});

// Password Change Form
forms.password.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }

    try {
        const formData = {
            currentPassword: document.getElementById('currentPassword').value,
            newPassword: newPassword
        };

        const response = await fetch('/api/user/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('Contraseña actualizada correctamente');
            forms.password.reset();
        } else {
            throw new Error('Error al actualizar la contraseña');
        }
    } catch (error) {
        alert(error.message);
    }
});

// New User Form
forms.newUser.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = forms.newUser.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    try {
        // Disable button and show spinner
        submitButton.disabled = true;
        submitButton.innerHTML = `${originalText} <span class="spinner"></span>`;

        const formData = {
            nombre: document.getElementById('newNombre').value,
            apellido: document.getElementById('newApellido').value,
            email: document.getElementById('newEmail').value,
            rol: document.getElementById('rol').value,
            member_id: document.getElementById('member_id').value
        };

        const response = await fetch('/api/user/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert(`Usuario creado correctamente.\nSe ha enviado la contraseña al email seleccionado.`);
            forms.newUser.reset();
            loadUsers(); // Refresh users table
        } else {
            throw new Error('Error al crear usuario');
        }
    } catch (error) {
        alert(error.message);
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
});

// Load Users Table
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.first_middle_name}</td>
                <td>${user.last_name}</td>
                <td>${user.email}</td>
                <td>${user.role_name}</td>
                <td>
                    <button onclick="editUser('${user.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteUser('${user.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
    }
}

// Pagination state
let currentPage = 1;
let totalPages = 1;
const logsPerPage = 10;

// Load Audit Logs with filters
async function loadAuditLogs(page = 1) {
    try {
        const filters = {
            accion: document.getElementById('filterAccion').value,
            categoria: document.getElementById('filterCategoria').value,
            usuario: document.getElementById('filterUsuario').value,
            detalle: document.getElementById('filterDetalle').value,
            fechaDesde: document.getElementById('filterFechaDesde').value,
            fechaHasta: document.getElementById('filterFechaHasta').value
        };

        const queryParams = new URLSearchParams({
            page: page,
            limit: logsPerPage,
            ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
        });

        const response = await fetch(`/api/audit-logs?${queryParams}`);
        const data = await response.json();
        const tbody = document.querySelector('#logsTable tbody');
        tbody.innerHTML = '';

        data.logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${log.action}</td>
                <td>${log.affected_object}</td>
                <td>${log.detail}</td>
                <td>${log.user}</td>
                <td>${new Date(log.date).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });

        // Update pagination state
        currentPage = page;
        totalPages = data.pages;
        
        // Update UI
        document.getElementById('currentPage').textContent = currentPage;
        document.getElementById('totalPages').textContent = totalPages;
        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= totalPages;
    } catch (error) {
        console.error('Error al cargar registros de auditoría:', error);
    }
}

// Add filter event listeners
document.getElementById('applyFilters').addEventListener('click', () => {
    currentPage = 1;
    loadAuditLogs(1);
});

document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('filterAccion').value = '';
    document.getElementById('filterCategoria').value = '';
    document.getElementById('filterUsuario').value = '';
    document.getElementById('filterDetalle').value = '';
    document.getElementById('filterFechaDesde').value = '';
    document.getElementById('filterFechaHasta').value = '';
    currentPage = 1;
    loadAuditLogs(1);
});

// Add pagination event listeners
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        loadAuditLogs(currentPage - 1);
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    if (currentPage < totalPages) {
        loadAuditLogs(currentPage + 1);
    }
});

// User Management Functions
let currentEditUserId = null;
const editUserModal = document.getElementById('editUserModal');
const editUserForm = document.getElementById('editUserForm');
const closeModalBtn = document.querySelector('.close');

// Close modal when clicking the X button or outside the modal
closeModalBtn.addEventListener('click', () => editUserModal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === editUserModal) {
        editUserModal.style.display = 'none';
    }
});

// Edit User Function
async function editUser(userId) {
    try {
        const response = await fetch(`/api/user/${userId}`);
        const user = await response.json();
        
        // Populate form with user data
        document.getElementById('editNombre').value = user.first_middle_name;
        document.getElementById('editApellido').value = user.last_name;
        document.getElementById('editEmail').value = user.email;
        document.getElementById('editRol').value = user.role_name.toLowerCase();
        
        // Store current user ID and show modal
        currentEditUserId = userId;
        editUserModal.style.display = 'block';
    } catch (error) {
        alert('Error al cargar datos del usuario');
        console.error(error);
    }
}

// Handle edit form submission
editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const formData = {
            nombre: document.getElementById('editNombre').value,
            apellido: document.getElementById('editApellido').value,
            email: document.getElementById('editEmail').value,
            rol: document.getElementById('editRol').value
        };

        const response = await fetch(`/api/user/${currentEditUserId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            editUserModal.style.display = 'none';
            loadUsers(); // Refresh the users table
            alert('Usuario actualizado correctamente');
        } else {
            throw new Error('Error al actualizar usuario');
        }
    } catch (error) {
        alert(error.message);
    }
});

async function deleteUser(userId) {
    if (confirm('¿Está seguro de que desea eliminar este usuario?')) {
        try {
            const response = await fetch(`/api/user/${userId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                loadUsers();
            } else {
                throw new Error('Error al eliminar usuario');
            }
        } catch (error) {
            alert(error.message);
        }
    }
}

// Modify the existing DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    checkUserRole();
});

// Load initial data
document.addEventListener('DOMContentLoaded', () => {
    checkUserRole();
});

// Initialize member search input and dropdown
const memberSearch = document.getElementById('memberSearch');
const memberDropdown = document.getElementById('memberDropdown');
let memberTimeout;
let membersData = {};

// Add member search functionality
memberSearch.addEventListener('input', function (e) {
    clearTimeout(memberTimeout);
    const query = e.target.value;

    if (query.length < 2) {
        memberDropdown.innerHTML = '';
        memberDropdown.classList.remove('active');
        return;
    }

    // Delay search to reduce API calls
    memberTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/api/members/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch members');
            }

            const members = await response.json();
            memberDropdown.innerHTML = '';
            membersData = {};

            if (members.length > 0) {
                members.forEach(member => {
                    const displayName = `${member.first_middle_name} ${member.last_name}`;
                    const option = document.createElement('div');
                    option.className = 'dropdown-option';
                    option.textContent = displayName;
                    option.addEventListener('click', () => selectMember(member));
                    memberDropdown.appendChild(option);
                    membersData[displayName] = member;
                });
                memberDropdown.classList.add('active');
            } else {
                memberDropdown.classList.remove('active');
            }
        } catch (error) {
            console.error('Error searching members:', error);
        }
    }, 300);
});

// Handle member selection
function selectMember(member) {
    memberSearch.value = `${member.first_middle_name} ${member.last_name}`;
    document.getElementById('member_id').value = member.id;
    document.getElementById('newNombre').value = member.first_middle_name;
    document.getElementById('newApellido').value = member.last_name;
    document.getElementById('newEmail').value = member.email || '';
    memberDropdown.classList.remove('active');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!memberSearch.contains(e.target) && !memberDropdown.contains(e.target)) {
        memberDropdown.classList.remove('active');
    }
});
